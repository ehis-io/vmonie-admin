/**
 * Money helpers. Amounts are decimal strings of kobo and never pass through a
 * JS number: formatting and parsing use BigInt and string arithmetic only.
 */

const groupThousands = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** `"123456789"` → `"₦1,234,567.89"`. Null/invalid → `"—"`. */
export function formatKobo(
  minor: string | number | bigint | null | undefined,
): string {
  if (minor === null || minor === undefined || minor === "") return "—";
  let value: bigint;
  try {
    // A number here would already be lossy above 2^53; the API sends strings.
    value = typeof minor === "bigint" ? minor : BigInt(String(minor));
  } catch {
    return String(minor);
  }
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const naira = groupThousands((abs / 100n).toString());
  const kobo = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}₦${naira}.${kobo}`;
}

/**
 * An amount in minor units in its own currency: naira as `₦1,234.56`, any
 * other as `USD 1,234.56`. For lists that mix currencies, where assuming
 * naira would misstate a row.
 */
export function formatMinor(
  minor: string | number | bigint | null | undefined,
  currency: string | null | undefined,
): string {
  const code = (currency ?? "NGN").toUpperCase();
  const formatted = formatKobo(minor);
  if (code === "NGN" || formatted === "—" || !formatted.includes("₦")) {
    return formatted;
  }
  return formatted.replace("₦", `${code} `);
}

const UNITS: [bigint, string][] = [
  [1_000_000_000n, "bn"],
  [1_000_000n, "m"],
  [1_000n, "k"],
];

/**
 * An amount in minor units, shortened for a tile or summary line:
 * `"420000000"` NGN → `"₦4.2m"`, GHS → `"GHS 4.2m"`. Under a thousand it is
 * shown in full. BigInt only; rounds down to one decimal.
 */
export function formatMinorCompact(
  minor: string | bigint | null | undefined,
  currency: string | null | undefined,
): string {
  if (minor === null || minor === undefined || minor === "") return "—";
  let value: bigint;
  try {
    value = typeof minor === "bigint" ? minor : BigInt(minor);
  } catch {
    return String(minor);
  }
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const major = abs / 100n;
  const unit = UNITS.find(([size]) => major >= size);
  if (!unit) return formatMinor(value, currency);
  const tenths = (abs * 10n) / (unit[0] * 100n);
  const whole = groupThousands((tenths / 10n).toString());
  const decimal = tenths % 10n === 0n ? "" : `.${tenths % 10n}`;
  const code = (currency ?? "NGN").toUpperCase();
  const symbol = code === "NGN" ? "₦" : `${code} `;
  return `${negative ? "-" : ""}${symbol}${whole}${decimal}${unit[1]}`;
}

/** `"150050"` → `"1500.50"`, for pre-filling a naira input. */
export function koboToNairaInput(minor: string | null | undefined): string {
  if (!minor || !/^-?\d+$/.test(minor)) return "";
  const value = BigInt(minor);
  const abs = value < 0n ? -value : value;
  return `${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

export type ParsedAmount =
  | { ok: true; kobo: string }
  | { ok: false; error: string };

/**
 * A naira amount typed by an operator → kobo string. Accepts `1500`,
 * `1,500.5`, `1500.50`; refuses more than two decimal places, signs,
 * exponents and zero.
 */
export function parseNairaToKobo(input: string): ParsedAmount {
  const cleaned = input.trim().replace(/,/g, "").replace(/^₦/, "");
  if (!cleaned) return { ok: false, error: "Enter an amount" };
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!m) {
    return {
      ok: false,
      error: "Enter naira with at most two decimal places, e.g. 1500.50",
    };
  }
  const whole = BigInt(m[1]);
  const fraction = BigInt((m[2] ?? "").padEnd(2, "0"));
  const kobo = whole * 100n + fraction;
  if (kobo <= 0n) return { ok: false, error: "Amount must be more than zero" };
  const s = kobo.toString();
  // The API accepts at most 16 digits of kobo.
  if (s.length > 16) return { ok: false, error: "Amount is too large" };
  return { ok: true, kobo: s };
}

/**
 * A naira decimal string as the payments partner sends it (`"1200.5"`) → `"₦1,200.50"`.
 * String arithmetic only. Null → `"—"`.
 */
export function formatNairaDecimal(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) return value;
  const kobo = ((m[3] ?? "") + "00").slice(0, 2);
  return `${m[1]}₦${groupThousands(m[2].replace(/^0+(?=\d)/, ""))}.${kobo}`;
}
