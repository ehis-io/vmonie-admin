"use client";

/**
 * Transactions per Lagos day: Completed, Failed, Reversed and Total as four
 * lines on one count axis. Hand-rolled SVG (no chart library), following the
 * console's dark surface: the three outcomes take the first three
 * categorical slots (validated all-pairs against the card surface), and
 * Total, the context line every other one sits under, is a neutral gray.
 *
 * Hover or arrow keys move a crosshair that snaps to a day and lists every
 * series; the legend names the series; "Show as table" gives every value
 * without hovering.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SummaryPoint } from "../lib/types";

type SeriesKey = "total" | "completed" | "failed" | "reversed";

export const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "total", label: "Total", color: "#cbd5e1" },
  { key: "completed", label: "Completed", color: "#3987e5" },
  { key: "failed", label: "Failed", color: "#d95926" },
  { key: "reversed", label: "Reversed", color: "#199e70" },
];

const HEIGHT = 240;
const PAD = { top: 12, right: 16, bottom: 28, left: 44 };
const GRID = "#283548";
const AXIS = "#3b4a61";

/** "2026-11-06" → "6 Nov". The date is already a Lagos day. */
export const dayLabel = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** Clean, round ticks from 0 to at least `max`. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const whole = Math.max(1, Math.ceil(step));
  const ticks: number[] = [];
  for (let v = 0; v < max + whole; v += whole) ticks.push(v);
  return ticks;
}

const compact = (n: number): string =>
  n >= 10_000
    ? new Intl.NumberFormat("en", { notation: "compact" }).format(n)
    : n.toLocaleString();

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.floor(entry.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export function TransactionsChart({
  series,
  dimmed = false,
}: {
  series: SummaryPoint[];
  /** Holding the previous render while a new window loads. */
  dimmed?: boolean;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const ticks = useMemo(
    () => niceTicks(Math.max(0, ...series.map((p) => p.total))),
    [series],
  );
  const top = ticks[ticks.length - 1];
  const x = (i: number) =>
    PAD.left + (series.length <= 1 ? plotW / 2 : (i * plotW) / (series.length - 1));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  // About six date labels, always the first and the last day.
  const every = Math.max(1, Math.ceil(series.length / 6));
  const last = series.length - 1;
  const xLabels = series
    .map((p, i) => ({ i, date: p.date }))
    // Every `every`th day, skipping one that would crowd the last day's.
    .filter(({ i }) => i === last || (i % every === 0 && last - i >= every / 2));

  const pick = (clientX: number, rect: DOMRect) => {
    if (!series.length) return;
    const rel = clientX - rect.left - PAD.left;
    const i = Math.round((rel / Math.max(1, plotW)) * (series.length - 1));
    setActive(Math.min(series.length - 1, Math.max(0, i)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!series.length) return;
    const at = active ?? last;
    const next =
      e.key === "ArrowLeft"
        ? Math.max(0, at - 1)
        : e.key === "ArrowRight"
          ? Math.min(last, at + 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) {
      if (e.key === "Escape") setActive(null);
      return;
    }
    e.preventDefault();
    setActive(next);
  };

  const point = active === null ? null : series[active];
  const tipLeft = active === null ? 0 : x(active);
  const tipOnLeft = tipLeft > width * 0.6;

  return (
    <div
      className={`transition-opacity ${dimmed ? "opacity-50" : ""}`}
      aria-busy={dimmed}
    >
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="14" height="4" aria-hidden="true">
              <line x1="1" y1="2" x2="13" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={box} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? series.length - 1)}
          onBlur={() => setActive(null)}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
        >
          <title id={titleId}>
            {`Transactions per day, ${series.length ? `${dayLabel(series[0].date)} to ${dayLabel(series[series.length - 1].date)}` : "no data"}. Use the arrow keys to read each day.`}
          </title>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? AXIS : GRID}
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted text-[10px] tabular-nums"
              >
                {compact(t)}
              </text>
            </g>
          ))}
          {xLabels.map(({ i, date }) => (
            <text
              key={date}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 && series.length > 1 ? "start" : i === last && series.length > 1 ? "end" : "middle"}
              className="fill-muted text-[10px]"
            >
              {dayLabel(date)}
            </text>
          ))}
          {point && active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke={AXIS}
              strokeWidth="1"
            />
          )}
          {SERIES.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={series.map((p, i) => `${x(i)},${y(p[s.key])}`).join(" ")}
            />
          ))}
          {point &&
            active !== null &&
            SERIES.map((s) => (
              <circle
                key={s.key}
                cx={x(active)}
                cy={y(point[s.key])}
                r="4"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth="2"
              />
            ))}
        </svg>
        {point && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs shadow-lg"
            style={
              tipOnLeft
                ? { right: width - tipLeft + 12 }
                : { left: tipLeft + 12 }
            }
          >
            <p className="mb-1 font-semibold text-foreground">{dayLabel(point.date)}</p>
            <ul className="space-y-0.5">
              {SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <svg width="10" height="4" aria-hidden="true">
                    <line x1="1" y1="2" x2="9" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="font-semibold tabular-nums text-foreground">
                    {point[s.key].toLocaleString()}
                  </span>
                  <span className="text-muted">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-foreground">
          Show as table
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-surface-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-[10px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Day</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {[...series].reverse().map((p) => (
                <tr key={p.date}>
                  <td className="px-3 py-1.5">{dayLabel(p.date)}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                      {p[s.key].toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
