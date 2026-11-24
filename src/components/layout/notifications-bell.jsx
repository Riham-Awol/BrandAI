"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** In-app notifications (approvals, reminders, failures, website messages). Polls every minute. */
export function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.readAt);

  useEffect(() => {
    let cancelled = false;
    const load = () => apiRequest("/api/v1/notifications").then((list) => !cancelled && setItems(list)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  async function onOpenChange(next) {
    setOpen(next);
    if (!next && unread.length) {
      const ids = unread.map((n) => n.id).slice(0, 100);
      setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n)));
      await apiRequest("/api/v1/notifications", { method: "PATCH", body: { ids } }).catch(() => {});
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger className="relative grid size-9 place-items-center rounded-full outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}>
        <Bell className="size-4.5" />
        {unread.length > 0 && <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">{Math.min(unread.length, 99)}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,360px)] p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold">Notifications</p>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.slice(0, 20).map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "/dashboard"} onClick={() => setOpen(false)} className={cn("block px-4 py-3 text-sm hover:bg-accent", !n.readAt && "bg-accent/40")}>
                  <p className="font-medium leading-snug">{n.title}</p>
                  {n.body && <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
