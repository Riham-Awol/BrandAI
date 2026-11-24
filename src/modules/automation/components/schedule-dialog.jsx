"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CalendarPlus, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MODES } from "../catalog.js";

function toLocalInput(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

/** Schedules a social post, an email campaign or a custom post; shows what the current mode will do. */
export function ScheduleDialog({ open, onOpenChange, workspaceId, businesses, integrations, mode, defaultDate, onDone }) {
  const [kind, setKind] = useState("CUSTOM");
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [sources, setSources] = useState({ posts: [], campaigns: [] });
  const [sourceId, setSourceId] = useState("");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [when, setWhen] = useState(() => toLocalInput(defaultDate ?? new Date(Date.now() + 3600000)));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const base = `/api/v1/workspaces/${workspaceId}/automation`;
  const active = integrations.filter((i) => i.status !== "DISABLED");

  useEffect(() => {
    if (!open || !businessId) return;
    let cancelled = false;
    apiRequest(`${base}/sources?businessId=${businessId}`).then((s) => !cancelled && setSources(s)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, businessId, base]);

  async function submit(submitNow) {
    setBusy(submitNow ? "submit" : "draft");
    setError(null);
    setErrors({});
    try {
      const body = { businessId, sourceType: kind, scheduledAt: new Date(when).toISOString(), submit: submitNow, integrationId: kind === "EMAIL_CAMPAIGN" ? null : integrationId || null };
      if (kind === "CUSTOM") Object.assign(body, { text, link });
      else body.sourceId = sourceId || undefined;
      const created = await apiRequest(`${base}/items`, { method: "POST", body });
      onOpenChange(false);
      setText("");
      setLink("");
      setSourceId("");
      onDone?.(created);
    } catch (e) {
      setError(e.message);
      setErrors(e.details ?? {});
    } finally {
      setBusy(null);
    }
  }

  const outcome = kind !== "EMAIL_CAMPAIGN" && !integrationId
    ? "No channel chosen: you'll get a reminder to post it yourself."
    : mode === "DRAFT_ONLY" ? "Draft-only mode: you'll get a reminder at that time; nothing is published automatically."
    : mode === "APPROVAL_REQUIRED" ? "Approval required: it goes out automatically once an owner or admin approves it."
    : "Authorized automation: it goes out automatically at that time (within your daily limits).";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule something</DialogTitle>
          <DialogDescription>Mode: {MODES[mode].label}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
          <div role="radiogroup" aria-label="What to schedule" className="flex flex-wrap gap-2">
            {[["CUSTOM", "Custom post"], ["SOCIAL_POST", "Social post"], ["EMAIL_CAMPAIGN", "Email campaign"]].map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setSourceId(""); }} className={cn("rounded-full border px-3 py-1.5 text-sm", kind === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>{l}</button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="s-business">Business</Label>
            <NativeSelect id="s-business" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </NativeSelect>
          </div>
          {kind === "CUSTOM" && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="s-text">Post text</Label>
                <Textarea id="s-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} aria-invalid={Boolean(errors.text) || undefined} />
                {errors.text && <p className="text-xs font-medium text-destructive">{errors.text[0]}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-link">Link (optional)</Label>
                <Input id="s-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
                {errors.link && <p className="text-xs font-medium text-destructive">{errors.link[0]}</p>}
              </div>
            </>
          )}
          {kind === "SOCIAL_POST" && (
            <div className="grid gap-1.5">
              <Label htmlFor="s-post">Post</Label>
              <NativeSelect id="s-post" value={sourceId} onChange={(e) => {
                setSourceId(e.target.value);
                const p = sources.posts.find((x) => x.id === e.target.value);
                if (p) setWhen(`${p.scheduledDate}T09:00`);
              }}>
                <option value="">Choose a written post…</option>
                {sources.posts.map((p) => <option key={p.id} value={p.id}>{p.scheduledDate} · {p.title} ({p.platform.toLowerCase()})</option>)}
              </NativeSelect>
              {!sources.posts.length && <p className="text-xs text-muted-foreground">Write posts in the Social Media Studio first.</p>}
            </div>
          )}
          {kind === "EMAIL_CAMPAIGN" && (
            <div className="grid gap-1.5">
              <Label htmlFor="s-campaign">Campaign</Label>
              <NativeSelect id="s-campaign" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Choose a draft campaign…</option>
                {sources.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </div>
          )}
          {kind !== "EMAIL_CAMPAIGN" && (
            <div className="grid gap-1.5">
              <Label htmlFor="s-channel">Channel</Label>
              <NativeSelect id="s-channel" value={integrationId} onChange={(e) => setIntegrationId(e.target.value)}>
                <option value="">None — I&apos;ll post it myself</option>
                {active.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </NativeSelect>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="s-when">Date and time</Label>
            <Input id="s-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <p className="rounded-lg bg-accent/50 p-3 text-sm">{outcome}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={busy !== null} onClick={() => submit(false)}>{busy === "draft" && <Loader2 className="animate-spin" />} Save as draft</Button>
          <Button disabled={busy !== null || !businessId} onClick={() => submit(true)}>{busy === "submit" ? <Loader2 className="animate-spin" /> : <CalendarPlus />} {mode === "APPROVAL_REQUIRED" ? "Schedule & request approval" : "Schedule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
