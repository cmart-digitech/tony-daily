"use client";

import { useMemo, useRef, useState } from "react";
import type { TimeSeriesBar } from "@/lib/market/types";

const RANGES = [
  { key: "1M", days: 22 },
  { key: "3M", days: 66 },
  { key: "6M", days: 132 },
  { key: "1Y", days: 260 },
] as const;

/**
 * Interactive daily price chart (brief §37): range switching, hover
 * crosshair with date + OHLC, readable in both themes, touch-friendly.
 * Period, currency, source and update time are stated beneath — data
 * honesty over decoration.
 */
export default function InteractiveChart({
  bars,
  currency,
  updatedLabel,
}: {
  bars: TimeSeriesBar[]; // ascending daily bars, up to ~260
  currency: string | null;
  updatedLabel: string;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3M");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const visible = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? 66;
    return bars.slice(-days);
  }, [bars, range]);

  const W = 720;
  const H = 240;
  const PAD = 8;

  const geometry = useMemo(() => {
    if (visible.length < 2) return null;
    const closes = visible.map((b) => b.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const step = W / (visible.length - 1);
    const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
    const path = closes
      .map((c, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(c).toFixed(1)}`)
      .join(" ");
    return { step, y, path, min, max };
  }, [visible]);

  if (!geometry || visible.length < 2) {
    return <p className="text-sm text-ink-3">Not enough data for a chart.</p>;
  }

  const positive = visible[visible.length - 1].close >= visible[0].close;
  const hovered = hover !== null ? visible[hover] : null;

  const locate = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const index = Math.round(x / geometry.step);
    setHover(Math.min(visible.length - 1, Math.max(0, index)));
  };

  const fmt = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (ts: number) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(ts));

  return (
    <figure>
      <div className="mb-2 flex items-center gap-1.5" role="group" aria-label="Chart range">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={range === r.key}
            onClick={() => {
              setRange(r.key);
              setHover(null);
            }}
            className={`rounded-sm px-2.5 py-1 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              range === r.key ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"
            }`}
          >
            {r.key}
          </button>
        ))}
        <span className="ml-auto min-h-5 font-mono text-xs text-ink-2" aria-live="polite">
          {hovered
            ? `${fmtDate(hovered.time)}  O ${fmt(hovered.open)}  H ${fmt(hovered.high)}  L ${fmt(hovered.low)}  C ${fmt(hovered.close)}`
            : ""}
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Daily closing price chart, ${range} range`}
        className="w-full touch-pan-y select-none"
        onMouseMove={(e) => locate(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => locate(e.touches[0].clientX)}
        onTouchMove={(e) => locate(e.touches[0].clientX)}
      >
        <path
          d={geometry.path}
          fill="none"
          stroke={positive ? "var(--up)" : "var(--down)"}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {hover !== null && hovered && (
          <>
            <line
              x1={hover * geometry.step}
              x2={hover * geometry.step}
              y1={0}
              y2={H}
              stroke="var(--line-strong)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={hover * geometry.step}
              cy={geometry.y(hovered.close)}
              r="4"
              fill={positive ? "var(--up)" : "var(--down)"}
            />
          </>
        )}
      </svg>
      <figcaption className="mt-2 text-xs text-ink-3">
        {range} · daily close · {currency ?? ""} · Twelve Data · {updatedLabel}
      </figcaption>
    </figure>
  );
}
