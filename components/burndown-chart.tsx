"use client";

import { useState } from "react";

// One point per burndown step, pre-formatted on the server so no Date
// crosses the server/client boundary. remaining is null for future days.
export type BurndownChartPoint = { label: string; ideal: number; remaining: number | null; tick: boolean };

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 16, right: 72, bottom: 32, left: 44 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

// Actual = the one colored series; ideal = a recessive muted-ink reference
// line, dashed so it never relies on color alone (with the legend below).
const ACTUAL = "var(--accent-lilac)";
const IDEAL = "var(--ink-muted)";
const GRID = "rgba(52, 48, 44, 0.1)";
const SURFACE = "var(--surface-base)";

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (factor * step >= value) return factor * step;
  }
  return 10 * step;
}

export function BurndownChart({ points }: { points: BurndownChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const yMax = niceMax(Math.max(...points.map((point) => Math.max(point.ideal, point.remaining ?? 0))));
  const x = (index: number) => PAD.left + (points.length > 1 ? (index / (points.length - 1)) * PLOT_W : 0);
  const y = (hours: number) => PAD.top + PLOT_H - (hours / yMax) * PLOT_H;
  // Fifths of a 1/2/2.5/5/10-rounded max always land on clean hour values.
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction) => fraction * yMax);

  const idealPath = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.ideal)}`).join("");
  const actual = points.map((point, index) => ({ index, remaining: point.remaining })).filter(
    (point): point is { index: number; remaining: number } => point.remaining !== null,
  );
  const actualPath = actual.map((point, i) => `${i === 0 ? "M" : "L"}${x(point.index)},${y(point.remaining)}`).join("");
  const last = actual.at(-1);
  const areaPath = last
    ? `${actualPath}L${x(last.index)},${y(0)}L${x(actual[0].index)},${y(0)}Z`
    : "";
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke={ACTUAL} strokeWidth="2" strokeLinecap="round" /></svg>
          Actual remaining
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke={IDEAL} strokeWidth="2" strokeDasharray="4 3" /></svg>
          Ideal
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={
            last
              ? `Burndown: ${points[last.index].remaining?.toFixed(1)} hours remaining as of ${points[last.index].label}, against an ideal of ${points[last.index].ideal.toFixed(1)} hours.`
              : "Burndown chart"
          }
          onMouseLeave={() => setHover(null)}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth="1" />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.round(tick)}h
              </text>
            </g>
          ))}
          {points.map((point, index) =>
            point.tick ? (
              <text key={index} x={x(index)} y={HEIGHT - 10} textAnchor="middle" fontSize="11" fill="var(--ink-muted)">
                {point.label}
              </text>
            ) : null,
          )}

          {areaPath && <path d={areaPath} fill={ACTUAL} opacity="0.1" />}
          <path d={idealPath} fill="none" stroke={IDEAL} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
          {actualPath && (
            <path d={actualPath} fill="none" stroke={ACTUAL} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {last && (
            <>
              <circle cx={x(last.index)} cy={y(last.remaining)} r="5" fill={ACTUAL} stroke={SURFACE} strokeWidth="2" />
              <text x={x(last.index) + 10} y={y(last.remaining)} dy="0.32em" fontSize="12" fontWeight="600" fill="var(--ink-primary)">
                {last.remaining.toFixed(1)}h left
              </text>
            </>
          )}

          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--ink-muted)" strokeWidth="1" />
          )}
          {hover !== null && points[hover].remaining !== null && (
            <circle cx={x(hover)} cy={y(points[hover].remaining!)} r="4" fill={ACTUAL} stroke={SURFACE} strokeWidth="2" />
          )}
          {/* Hit columns wider than the marks, one per step. */}
          {points.map((_, index) => (
            <rect
              key={index}
              x={x(index) - PLOT_W / Math.max(points.length - 1, 1) / 2}
              y={PAD.top}
              width={PLOT_W / Math.max(points.length - 1, 1)}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          ))}
        </svg>

        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border border-border bg-[color:var(--surface-base)] px-3 py-2 text-xs shadow-sm"
            style={{ left: `${(x(hover) / WIDTH) * 100}%` }}
          >
            <div className="mb-1 font-medium text-foreground">{hovered.label}</div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block size-2 rounded-full" style={{ background: ACTUAL }} />
              Remaining{" "}
              <span className="font-heading text-foreground">
                {hovered.remaining !== null ? `${hovered.remaining.toFixed(1)}h` : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block h-0.5 w-2" style={{ background: IDEAL }} />
              Ideal <span className="font-heading text-foreground">{hovered.ideal.toFixed(1)}h</span>
            </div>
          </div>
        )}
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">Show as table</summary>
        <table className="mt-2 w-full max-w-sm text-left" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">Ideal</th>
              <th className="py-1 text-right font-medium">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={index} className="border-t border-border">
                <td className="py-1 text-foreground">{point.label}</td>
                <td className="py-1 text-right">{point.ideal.toFixed(1)}h</td>
                <td className="py-1 text-right text-foreground">
                  {point.remaining !== null ? `${point.remaining.toFixed(1)}h` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
