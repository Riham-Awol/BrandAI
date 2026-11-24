"use client";

import { useCallback, useState } from "react";
import { AlertCircle, CalendarPlus, Check, CheckCircle2, ExternalLink, Loader2, Send, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "../catalog.js";
import { ScheduleDialog } from "./schedule-dialog";

const FILTERS = [
  ["attention", "Needs attention", ["PENDING_APPROVAL", "MANUAL_DUE", "FAILED"]],
  ["upcoming", "Scheduled", ["APPROVED", "DRAFT", "PUBLISHING"]],
  ["done", "Published", ["PUBLISHED"]],
  ["closed", "Rejected & cancelled", ["REJECTED", "CANCELLED"]],
];
const VARIANT = { PENDING_APPROVAL: "warning", MANUAL_DUE: "warning", FAILED: "warning", APPROVED: "default", PUBLISHED: "success", DRAFT: "secondary", REJECTED: "secondary", CANCELLED: "secondary", PUBLISHING: "secondary" };

export function QueueBoard({ workspaceId, initialItems, businesses, integrations, settings }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState(() => (initialItems.some((i) => FILTERS[0][2].includes(i.status)) ? "attention" : "upcoming"));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState({});
  const [urls, setUrls] = useState({});
  const [dialog, setDialog] = useState(false);
  const base = `/api/v1/workspaces/${workspaceId}/automation`;
  const { canSchedule, canApprove } = settings.permissions;

  const reload = useCallback(async () => setItems(await apiRequest(`${base}/items`)), [base]);
  async function act(key, path, body) {
    setBusy(key);
    setError(null);
    try {
      await apiRequest(`${base}/items/${path}`, { method: "POST", body });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const statuses = FILTERS.find((f) => f[0] === filter)[2];
  const shown = items.filter((i) => statuses.includes(i.status));
  const count = (f) => items.filter((i) => f[2].includes(i.status)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Queue filter" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button key={f[0]} role="tab" aria-selected={filter === f[0]} onClick={() => setFilter(f[0])} className={cn("rounded-full px-3 py-1.5 text-sm", filter === f[0] ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              {f[1]} <span className="opacity-70">({count(f)})</span>
            </button>
          ))}
        </div>
        {canSchedule && businesses.length > 0 && <Button onClick={() => setDialog(true)}><CalendarPlus /> Schedule something</Button>}
      </div>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {shown.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((i) => (
            <li key={i.id} id={i.id}>
              <Card className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{i.title}</p>
                    <p className="text-sm text-muted-foreground">{new Date(i.scheduledAt).toLocaleString()} · {i.business.name} · {i.sourceType === "EMAIL_CAMPAIGN" ? "Email to your audience" : i.integration?.name ?? "Manual (no channel)"}</p>
                  </div>
                  <Badge variant={VARIANT[i.status]}>{STATUS_LABELS[i.status]}</Badge>
                </div>
                {i.sourceType !== "EMAIL_CAMPAIGN" && <p className="line-clamp-4 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">{i.content.text}{i.content.link ? `\n${i.content.link}` : ""}</p>}
                {i.decisionNote && <p className="text-xs text-muted-foreground">Note: {i.decisionNote}</p>}
                {i.lastError && <p className="text-sm text-destructive">{i.lastError}</p>}
                {i.externalUrl && <a href={i.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-sm text-highlight underline">View post <ExternalLink className="size-3.5" /></a>}
                <div className="flex flex-wrap items-center gap-2">
                  {i.status === "PENDING_APPROVAL" && canApprove && (
                    <>
                      <Input aria-label={`Note for ${i.title}`} placeholder="Note (optional)" className="h-9 w-full sm:w-56" value={notes[i.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [i.id]: e.target.value }))} />
                      <Button size="sm" disabled={busy !== null} onClick={() => act(`a-${i.id}`, `${i.id}/decision`, { approve: true, note: notes[i.id] })}>{busy === `a-${i.id}` ? <Loader2 className="animate-spin" /> : <Check />} Approve</Button>
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(`r-${i.id}`, `${i.id}/decision`, { approve: false, note: notes[i.id] })}><X /> Reject</Button>
                    </>
                  )}
                  {i.status === "PENDING_APPROVAL" && !canApprove && <p className="text-sm text-muted-foreground">Waiting for an owner or admin.</p>}
                  {i.status === "DRAFT" && canSchedule && <Button size="sm" disabled={busy !== null} onClick={() => act(`s-${i.id}`, `${i.id}/submit`)}>Submit</Button>}
                  {i.status === "REJECTED" && canSchedule && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(`s-${i.id}`, `${i.id}/submit`)}>Resubmit</Button>}
                  {["MANUAL_DUE", "FAILED", "APPROVED"].includes(i.status) && canApprove && (i.integration || i.sourceType === "EMAIL_CAMPAIGN") && (
                    <Button size="sm" disabled={busy !== null} onClick={() => act(`p-${i.id}`, `${i.id}/publish-now`)}>{busy === `p-${i.id}` ? <Loader2 className="animate-spin" /> : <Send />} {i.sourceType === "EMAIL_CAMPAIGN" ? "Send now" : "Publish now"}</Button>
                  )}
                  {["MANUAL_DUE", "FAILED"].includes(i.status) && canSchedule && i.sourceType !== "EMAIL_CAMPAIGN" && (
                    <>
                      <Input aria-label={`Post URL for ${i.title}`} placeholder="Post URL (optional)" className="h-9 w-full sm:w-56" value={urls[i.id] ?? ""} onChange={(e) => setUrls((u) => ({ ...u, [i.id]: e.target.value }))} />
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(`m-${i.id}`, `${i.id}/posted`, { externalUrl: urls[i.id] ?? "" })}><CheckCircle2 /> Mark as posted</Button>
                    </>
                  )}
                  {!["PUBLISHED", "PUBLISHING", "CANCELLED"].includes(i.status) && canSchedule && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act(`c-${i.id}`, `${i.id}/cancel`)}>Cancel</Button>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {dialog && <ScheduleDialog open onOpenChange={setDialog} workspaceId={workspaceId} businesses={businesses} integrations={integrations} mode={settings.mode} onDone={async (created) => { await reload(); const bucket = FILTERS.find((f) => f[2].includes(created?.status)); if (bucket) setFilter(bucket[0]); }} />}
    </div>
  );
}
