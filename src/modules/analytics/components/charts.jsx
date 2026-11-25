"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatChange, formatValue } from "../metrics.js";

/*
 * Charts follow the dataviz method: validated colour tokens (--chart-1/2 for
 * the two daily series, --chart-bar for single-series bars), 2px lines, 4px
 * rounded bar ends, hairline solid grid, text in text tokens, a crosshair
 * tooltip with keyboard support, a legend for two series and a table view.
 */

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayLabel = (d, long = false) => (long ? LONG : SHORT).format(new Date(`${d}T00:00:00Z`));
const compact = (n) => (n >= 10000 ? new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n) : n.toLocaleString("en-GB"));

/** Clean axis ticks: 0 … niceMax in 1/2/5 × 10^k steps, about four of them. */
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function LineKey({ color }) {
  return <span aria-hidden="true" className="inline-block h-0.5 w-3.5 shrink-0 rounded-full" style={{ background: `var(${color})` }} />;
}

/**
 * Daily series as lines on one shared count axis. `series`: [{ key, label, color }]
 * with color a CSS variable name. Rows: [{ day, [key]: number }].
 */
export function DailyLineChart({ title, rows, series, height = 220 }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const [table, setTable] = useState(false);
  const m = { top: 14, right: 44, bottom: 26, left: 40 };
  const w = Math.max(0, width - m.left - m.right);
  const h = height - m.top - m.bottom;
  const max = Math.max(0, ...rows.flatMap((r) => series.map((s) => r[s.key])));
  const ticks = niceTicks(max);
  const top = ticks.at(-1);
  const x = (i) => (rows.length > 1 ? (i / (rows.length - 1)) * w : w / 2);
  const y = (v) => h - (v / top) * h;
  const path = (key) => rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join("");
  const xLabels = rows.length ? [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])] : [];
  const last = rows.length - 1;
  const idx = active ?? null;

  function onMove(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left - m.left;
    setActive(Math.max(0, Math.min(last, Math.round((px / Math.max(1, w)) * last))));
  }
  function onKey(e) {
    if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? last) - 1));
    else if (e.key === "ArrowRight") setActive((i) => Math.min(last, (i ?? last) + 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else return;
    e.preventDefault();
  }
  const total = (key) => rows.reduce((s, r) => s + r[key], 0);
  // End labels only when the two endpoints are far enough apart not to collide.
  const endYs = series.map((s) => y(rows[last]?.[s.key] ?? 0));
  const showEnd = series.length < 2 || Math.abs(endYs[0] - endYs[1]) >= 14;

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="text-sm font-semibold">{title}</figcaption>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.length > 1 && series.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><LineKey color={s.color} />{s.label}</span>)}
          <button type="button" className="rounded px-1 underline underline-offset-2 hover:text-foreground" aria-pressed={table} onClick={() => setTable((t) => !t)}>{table ? "Show chart" : "Show table"}</button>
        </div>
      </div>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-card text-left text-muted-foreground"><tr><th scope="col" className="px-3 py-2 font-medium">Day</th>{series.map((s) => <th key={s.key} scope="col" className="px-3 py-2 text-right font-medium">{s.label}</th>)}</tr></thead>
            <tbody className="divide-y tabular-nums">{[...rows].reverse().map((r) => <tr key={r.day}><td className="px-3 py-1.5">{dayLabel(r.day, true)}</td>{series.map((s) => <td key={s.key} className="px-3 py-1.5 text-right">{r[s.key].toLocaleString("en-GB")}</td>)}</tr>)}</tbody>
            <tfoot className="border-t font-semibold tabular-nums"><tr><td className="px-3 py-2">Total</td>{series.map((s) => <td key={s.key} className="px-3 py-2 text-right">{total(s.key).toLocaleString("en-GB")}</td>)}</tr></tfoot>
          </table>
        </div>
      ) : (
        <div
          ref={ref}
          className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ height }}
          tabIndex={0}
          role="img"
          aria-label={`${title}. ${series.map((s) => `${s.label}: ${total(s.key)} in total`).join("; ")}. Use the arrow keys to read each day, or show the table.`}
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((i) => i ?? last)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
        >
          {width > 0 && rows.length > 0 && (
            <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
              <g transform={`translate(${m.left},${m.top})`}>
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} shapeRendering="crispEdges" />
                    <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{compact(t)}</text>
                  </g>
                ))}
                {xLabels.map((i) => (
                  <text key={i} x={x(i)} y={h + 18} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} className="fill-muted-foreground text-[11px]">{dayLabel(rows[i].day)}</text>
                ))}
                {series.map((s) => <path key={s.key} d={path(s.key)} fill="none" stroke={`var(${s.color})`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
                {idx !== null && <line x1={x(idx)} x2={x(idx)} y1={0} y2={h} stroke="var(--muted-foreground)" strokeWidth={1} shapeRendering="crispEdges" />}
                {series.map((s) => {
                  const i = idx ?? last;
                  return <circle key={s.key} cx={x(i)} cy={y(rows[i][s.key])} r={4} fill={`var(${s.color})`} stroke="var(--card)" strokeWidth={2} />;
                })}
                {idx === null && showEnd && series.map((s) => (
                  <text key={s.key} x={w + 8} y={y(rows[last][s.key])} dy="0.32em" className="fill-foreground text-[11px] font-semibold tabular-nums">{compact(rows[last][s.key])}</text>
                ))}
              </g>
            </svg>
          )}
          {idx !== null && width > 0 && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-1 z-10 min-w-32 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lift"
              style={x(idx) + m.left > width / 2 ? { right: width - (x(idx) + m.left) + 10 } : { left: x(idx) + m.left + 10 }}
            >
              <p className="mb-1 text-muted-foreground">{dayLabel(rows[idx].day, true)}</p>
              {series.map((s) => (
                <p key={s.key} className="flex items-center gap-2"><LineKey color={s.color} /><span className="font-semibold tabular-nums">{rows[idx][s.key].toLocaleString("en-GB")}</span><span className="text-muted-foreground">{s.label}</span></p>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

/** Single-series horizontal bars (one validated hue), value at the tip, per-bar tooltip. */
export function BarList({ title, rows, labelKey, format = (v) => v.toLocaleString("en-GB"), labelFor = (r) => r[labelKey], empty = "No data yet." }) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  const total = rows.reduce((s, r) => s + r.views, 0);
  return (
    <figure className="space-y-3">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {rows.length === 0 || total === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const share = Math.round((r.views / total) * 100);
            return (
              <li key={labelFor(r)} className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,10rem)_1fr]">
                <span className="truncate text-sm" title={labelFor(r)}>{labelFor(r)}</span>
                <div className="group relative flex items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} aria-label={`${labelFor(r)}: ${format(r.views)} (${share}%)`}>
                  <div className={cn("h-3 min-w-0.5 rounded-r-[4px] transition-opacity group-hover:opacity-80", r.other ? "bg-muted-foreground/50" : "bg-chart-bar")} style={{ width: `${(r.views / max) * 80}%` }} />
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{format(r.views)} · {share}%</span>
                  <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 hidden w-max max-w-64 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lift group-hover:block group-focus:block">
                    <span className="font-semibold tabular-nums">{format(r.views)}</span> <span className="text-muted-foreground">{labelFor(r)} · {share}% of the total</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

/** Stat tile: label · value · delta vs the previous period (direction × whether up is good, with an icon). */
export function KpiTile({ kpi, days }) {
  const ch = formatChange(kpi.change);
  const up = kpi.change > 0;
  const down = kpi.change < 0;
  const good = kpi.goodWhen === "down" ? down : up;
  const bad = kpi.goodWhen === "down" ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <div data-testid="kpi-tile" className="min-w-0 rounded-xl border bg-card p-3 shadow-soft sm:p-4">
      <p className="text-sm text-muted-foreground">{kpi.label}</p>
      <p className="mt-0.5 text-2xl font-semibold">{formatValue(kpi.value, kpi.format)}</p>
      <p className={cn("mt-1 flex items-center gap-1 text-xs", good ? "text-success" : bad ? "text-destructive" : "text-muted-foreground")}>
        {ch ? <><Icon className="size-3.5" aria-hidden="true" /><span className="font-medium">{ch}</span><span className="text-muted-foreground">vs previous {days} days ({formatValue(kpi.previous, kpi.format)})</span></> : <span>{kpi.previous == null || kpi.previous === 0 ? `No earlier ${days}-day figure to compare` : "No change"}</span>}
      </p>
      {kpi.hint && <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>}
    </div>
  );
}
