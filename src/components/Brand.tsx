import Link from "next/link";

/** Vmonie's mark (the "V" from app/icon.svg) on the brand blue. */
export function VmonieMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/30"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width={size * 0.75} height={size * 0.75}>
        <path
          d="M8 9l8 15 8-15"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <VmonieMark />
      <span className="text-sm font-semibold tracking-tight text-foreground">
        Vmonie Admin
      </span>
    </Link>
  );
}
