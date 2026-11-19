"use client";
import { useState } from "react";
import { MIN_TREND_POINTS } from "@/lib/evolution";
import { dateLabel, number } from "@/lib/format";

/**
 * Single-series trend line. One series → no legend; the title names it.
 * 2px line, 8px markers, recessive grid, hover/focus tooltip and a table view.
 * Renders nothing chart-like until there are enough real measurements.
 */
export function TrendChart({
  title,
  unit,
  points,
}: {
  title: string;
  unit: string;
  points: { date: string; value: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  if (points.length < MIN_TREND_POINTS)
    return (
      <p className="muted small">
        {title}: يظهر الاتجاه بعد {number(MIN_TREND_POINTS)} قياسات على الأقل
        (لديك {number(points.length)}).
      </p>
    );
  const W = 560,
    H = 180,
    pad = { t: 14, r: 12, b: 26, l: 40 };
  const values = points.map((p) => p.value);
  const min = Math.min(...values),
    max = Math.max(...values);
  const lo = min === max ? min * 0.9 : min - (max - min) * 0.1;
  const hi = min === max ? max * 1.1 || 1 : max + (max - min) * 0.1;
  const x = (i: number) =>
    pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, points.length - 1);
  const y = (v: number) =>
    pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  const path = points
    .map(
      (p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
    )
    .join("");
  const fmt = (v: number) =>
    new Intl.NumberFormat("ar-PS", { maximumFractionDigits: 1 }).format(v);
  return (
    <figure className="evo-trend">
      <figcaption>
        <strong>{title}</strong>
        <button
          type="button"
          className="text-link"
          onClick={() => setTable(!table)}
          aria-expanded={table}
        >
          {table ? "عرض الرسم" : "عرض كجدول"}
        </button>
      </figcaption>
      {table ? (
        <table className="evo-table">
          <thead>
            <tr>
              <th scope="col">التاريخ</th>
              <th scope="col">القيمة ({unit})</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>
                  {dateLabel(p.date, undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td>{fmt(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="evo-trend-wrap" dir="ltr">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${title}: ${points.length} قياسات من ${fmt(min)} إلى ${fmt(max)} ${unit}`}
          >
            {ticks.map((t, i) => (
              <g key={i}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(t)}
                  y2={y(t)}
                  className="evo-grid-line"
                />
                <text
                  x={pad.l - 6}
                  y={y(t) + 4}
                  textAnchor="end"
                  className="evo-axis-text"
                >
                  {fmt(t)}
                </text>
              </g>
            ))}
            <path
              d={path}
              fill="none"
              stroke="var(--mqw-sapphire)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={pad.t}
                y2={H - pad.b}
                className="evo-crosshair"
              />
            )}
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={x(i)}
                  cy={y(p.value)}
                  r={4}
                  fill="var(--mqw-sapphire)"
                  stroke="#fff"
                  strokeWidth={2}
                />
                <circle
                  cx={x(i)}
                  cy={y(p.value)}
                  r={14}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${dateLabel(p.date, undefined, { day: "numeric", month: "short" })}: ${fmt(p.value)} ${unit}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            ))}
            <text x={pad.l} y={H - 6} className="evo-axis-text">
              {dateLabel(points[0].date, undefined, {
                day: "numeric",
                month: "short",
              })}
            </text>
            <text
              x={W - pad.r}
              y={H - 6}
              textAnchor="end"
              className="evo-axis-text"
            >
              {dateLabel(points.at(-1)!.date, undefined, {
                day: "numeric",
                month: "short",
              })}
            </text>
          </svg>
          {hover !== null && (
            <div
              className="evo-tooltip"
              style={{
                left: `${(x(hover) / W) * 100}%`,
                top: `${(y(points[hover].value) / H) * 100}%`,
              }}
              role="status"
            >
              <strong>
                {fmt(points[hover].value)} {unit}
              </strong>
              <small>
                {dateLabel(points[hover].date, undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </small>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
