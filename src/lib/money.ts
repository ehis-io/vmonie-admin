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
