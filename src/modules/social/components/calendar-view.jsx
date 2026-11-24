import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FORMATS, PLATFORMS, daysInMonth, dateForDay } from "../platforms.js";

/** Month grid on desktop, agenda list on small screens. Platforms are named in text, not by colour. */
export function CalendarView({ month, entries }) {
  const days = daysInMonth(month);
  const firstWeekday = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const byDay = new Map();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <div className="grid grid-cols-7 bg-muted/60 text-center text-xs font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => (
            <div key={i} className={cn("min-h-24 border-t border-l p-1.5 text-xs [&:nth-child(7n+1)]:border-l-0", !day && "bg-muted/30")}>
              {day && <p className="mb-1 font-semibold text-muted-foreground">{day}</p>}
              <ul className="space-y-1">
                {(byDay.get(day) ?? []).map((e, j) => (
                  <li key={j} className={cn("rounded-md border bg-card px-1.5 py-1 leading-tight", e.isPromotion && "border-highlight")}>
                    <span className="block font-semibold">{PLATFORMS[e.platform].label} · {FORMATS[e.format]}</span>
                    <span className="block text-muted-foreground">{e.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <ul className="divide-y rounded-xl border md:hidden">
        {entries.map((e, i) => (
          <li key={i} className="flex gap-3 p-3">
            <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{dateForDay(month, e.day).slice(8)}</span>
            <span className="min-w-0 space-y-1">
              <span className="block text-sm font-medium">{e.title}</span>
              <span className="flex flex-wrap gap-1">
                <Badge variant="outline">{PLATFORMS[e.platform].label}</Badge>
                <Badge variant="outline">{FORMATS[e.format]}</Badge>
                {e.isPromotion && <Badge variant="warning">Promotion</Badge>}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
