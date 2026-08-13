"use client";

/** Minimal dependency-free SVG line chart for close prices. */
export default function Sparkline({
  points,
  width = 120,
  height = 36,
  positive,
}: {
  points: number[];
  width?: number;
  height?: number;
  positive: boolean;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - 2 - ((p - min) / range) * (height - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <path
        d={d}
        fill="none"
        stroke={positive ? "var(--up)" : "var(--down)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
