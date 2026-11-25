"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Tracking switches and data retention (admins and the owner can change them). */
export function AnalyticsSettings({ workspaceId, initial }) {
  const [form, setForm] = useState({ trackSiteVisits: initial.trackSiteVisits, trackEmailEngagement: initial.trackEmailEngagement, retentionDays: String(initial.retentionDays) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const disabled = !initial.canManage;

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/api/v1/workspaces/${workspaceId}/analytics/settings`, { method: "PUT", body: form });
      setMessage("Saved.");
    } catch (e) {
      setError(e.details?.retentionDays?.[0] ?? e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl gap-5">
      {disabled && <p className="text-sm text-muted-foreground">Only workspace admins and the owner can change these settings.</p>}
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-4 accent-primary" disabled={disabled} checked={form.trackSiteVisits} onChange={(e) => setForm((f) => ({ ...f, trackSiteVisits: e.target.checked }))} />
        <span><span className="font-medium">Count website visits</span><span className="block text-sm text-muted-foreground">Cookieless: a visitor is a daily-changing anonymous code; IP addresses are never stored. Bots and browsers that ask not to be tracked are skipped.</span></span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-4 accent-primary" disabled={disabled} checked={form.trackEmailEngagement} onChange={(e) => setForm((f) => ({ ...f, trackEmailEngagement: e.target.checked }))} />
        <span><span className="font-medium">Track email opens and clicks</span><span className="block text-sm text-muted-foreground">Adds an invisible image and a click link to campaign emails. Opens are approximate (some apps block or pre-load images). Mention it in your privacy notice; in some countries you need consent for it.</span></span>
      </label>
      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="retention">Keep visit and email data for (days)</Label>
        <Input id="retention" type="number" min={30} max={730} disabled={disabled} value={form.retentionDays} onChange={(e) => setForm((f) => ({ ...f, retentionDays: e.target.value }))} />
        <p className="text-xs text-muted-foreground">30–730 days. Older rows are deleted automatically by the scheduler.</p>
      </div>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      {!disabled && <Button className="w-fit" disabled={busy} onClick={save}>{busy && <Loader2 className="animate-spin" />} Save settings</Button>}
    </Card>
  );
}
