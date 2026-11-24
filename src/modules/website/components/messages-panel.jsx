"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Inbox, Mail, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MessagesPanel({ base, canEdit, onChanged }) {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    apiRequest(`${base}/messages`)
      .then((m) => !cancelled && setMessages(m))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [base, canEdit]);

  if (!canEdit) return <p className="text-sm text-muted-foreground">Messages contain customers&apos; personal details and are visible to editors, admins and owners.</p>;
  if (error) return <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>;
  if (messages === null) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  if (messages.length === 0) {
    return (
      <Card className="items-center gap-2 py-12 text-center">
        <Inbox className="size-8 text-muted-foreground" />
        <p className="font-medium">No messages yet</p>
        <p className="max-w-md text-sm text-muted-foreground">Contact and order enquiries sent from your published website appear here, and you get a notification.</p>
      </Card>
    );
  }

  async function act(request, update) {
    try {
      await request();
      setMessages(update);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
  }
  const markRead = (m) =>
    act(
      () => apiRequest(`${base}/messages/${m.id}`, { method: "PATCH", body: { read: !m.readAt } }),
      (list) => list.map((x) => (x.id === m.id ? { ...x, readAt: x.readAt ? null : new Date().toISOString() } : x)),
    );
  const remove = (m) =>
    act(
      () => apiRequest(`${base}/messages/${m.id}`, { method: "DELETE" }),
      (list) => list.filter((x) => x.id !== m.id),
    );

  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <li key={m.id}>
          <Card className={`gap-3 ${m.readAt ? "" : "border-highlight/60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{m.name} {!m.readAt && <Badge className="ml-1">New</Badge>} {m.kind === "order" && <Badge variant="success" className="ml-1">Order</Badge>}</p>
                <p className="break-all text-sm text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ""} · {new Date(m.createdAt).toLocaleString()} · page {m.pagePath}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" asChild><a href={`mailto:${m.email}?subject=${encodeURIComponent(m.item ? `Your order: ${m.item}` : "Re: your message")}`}><Mail /> Reply</a></Button>
                <Button size="sm" variant="ghost" onClick={() => markRead(m)}>{m.readAt ? "Mark unread" : "Mark read"}</Button>
                <Button size="icon" variant="ghost" onClick={() => remove(m)} aria-label="Delete message"><Trash2 /></Button>
              </div>
            </div>
            {m.item && <p className="text-sm"><span className="text-muted-foreground">Item:</span> {m.item}</p>}
            <p className="whitespace-pre-line text-[15px]">{m.message}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
