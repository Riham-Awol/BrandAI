"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CalendarPlus, ChevronLeft, ChevronRight, FileText, Mail, Megaphone, Send } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "../catalog.js";
import { ScheduleDialog } from "./schedule-dialog";

const KIND = {
  scheduled: { icon: Send, label: "Scheduled", cls: "bg-primary/10 text-foreground border-primary/30" },
  email: { icon: Mail, label: "Email", cls: "bg-highlight/10 text-foreground border-highlight/40" },
  post: { icon: Megaphone, label: "Planned post", cls: "bg-muted text-muted-foreground border-dashed" },
  reminder: { icon: Bell, label: "Reminder", cls: "bg-warning/10 text-foreground border-warning/40" },
  invoice: { icon: FileText, label: "Invoice due", cls: "bg-success/10 text-foreground border-success/40" },
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const eventDay = (e) => (e.allDay ? e.at : ymd(new Date(e.at)));

/** Month calendar (grid on wide screens, agenda on phones) across studios. */
export function CalendarView({ workspaceId, businesses, integrations, mode, canSchedule }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState(null);

  const range = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 42);
    return { start, end };
  }, [month]);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/v1/workspaces/${workspaceId}/automation/calendar?from=${range.start.toISOString()}&to=${range.end.toISOString()}`);
      setEvents(data.events);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [workspaceId, range]);

  useEffect(() => {
    let cancelled = false;
    apiRequest(`/api/v1/workspaces/${workspaceId}/automation/calendar?from=${range.start.toISOString()}&to=${range.end.toISOString()}`)
      .then((d) => !cancelled && setEvents(d.events))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, range]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of events ?? []) {
      const k = eventDay(e);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [events]);

  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(range.start); d.setDate(d.getDate() + i); return d; });
  const today = ymd(new Date());
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const agenda = (events ?? []).filter((e) => eventDay(e).slice(0, 7) === ymd(month).slice(0, 7));

  const Chip = ({ e }) => {
    const k = KIND[e.kind];
    const Icon = k.icon;
    return (
      <Link href={e.href} className={cn("flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[11px] leading-tight", k.cls)} title={`${e.title} — ${e.detail}${e.status && e.kind !== "post" ? ` · ${STATUS_LABELS[e.status] ?? e.status}` : ""}`}>
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{!e.allDay && `${new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} `}{e.title}</span>
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
          <h2 className="min-w-40 text-center font-display text-xl font-semibold" aria-live="polite">{monthLabel}</h2>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
        </div>
        {canSchedule && businesses.length > 0 && <Button onClick={() => setDialog(new Date(Date.now() + 3600000))}><CalendarPlus /> Schedule something</Button>}
      </div>
      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Legend">
        {Object.entries(KIND).map(([k, v]) => <li key={k} className="flex items-center gap-1"><v.icon className="size-3.5" aria-hidden="true" /> {v.label}</li>)}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {events === null ? <Skeleton className="h-[480px] w-full" /> : (
        <>
          <Card className="hidden overflow-hidden p-0 md:block">
            <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">{WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = ymd(d);
                const list = byDay.get(key) ?? [];
                const inMonth = d.getMonth() === month.getMonth();
                return (
                  <div key={key} className={cn("group min-h-28 border-r border-b p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/30 text-muted-foreground")}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={cn("grid size-6 place-items-center rounded-full text-xs", key === today && "bg-primary font-semibold text-primary-foreground")}>{d.getDate()}</span>
                      {canSchedule && businesses.length > 0 && <button type="button" aria-label={`Schedule on ${key}`} onClick={() => setDialog(new Date(`${key}T09:00`))} className="rounded px-1 text-xs text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100">+</button>}
                    </div>
                    <div className="space-y-1">{list.slice(0, 4).map((e) => <Chip key={e.id} e={e} />)}{list.length > 4 && <p className="text-[11px] text-muted-foreground">+{list.length - 4} more</p>}</div>
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="space-y-2 md:hidden">
            {agenda.length === 0 ? <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Nothing planned this month.</p> : agenda.map((e) => (
              <Link key={e.id} href={e.href} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                <div className="w-12 shrink-0 text-center"><p className="text-xs text-muted-foreground">{new Date(`${eventDay(e)}T00:00`).toLocaleDateString(undefined, { weekday: "short" })}</p><p className="text-lg font-semibold">{Number(eventDay(e).slice(8))}</p></div>
                <div className="min-w-0"><p className="truncate font-medium">{e.title}</p><p className="truncate text-xs text-muted-foreground">{KIND[e.kind].label}{!e.allDay && ` · ${new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} · {e.detail}</p></div>
              </Link>
            ))}
          </div>
        </>
      )}
      {dialog && <ScheduleDialog open onOpenChange={(o) => !o && setDialog(null)} workspaceId={workspaceId} businesses={businesses} integrations={integrations} mode={mode} defaultDate={dialog} onDone={load} />}
    </div>
  );
}
