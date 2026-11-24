"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarPlus, Info, Loader2, Mail, Save, Sparkles, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const toForm = (c) => ({ name: c.name, subject: c.subject, preheader: c.preheader, heading: c.content.heading, body: c.content.paragraphs.join("\n\n"), ctaLabel: c.content.ctaLabel, ctaUrl: c.content.ctaUrl });
const toBody = (f) => ({ name: f.name, subject: f.subject, preheader: f.preheader, content: { heading: f.heading, paragraphs: f.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean), ctaLabel: f.ctaLabel, ctaUrl: f.ctaUrl } });

/** New campaign: AI draft or blank. */
export function NewCampaignForm({ workspaceId, businesses, ai }) {
  const router = useRouter();
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}/automation/campaigns`;
  async function create(withAi) {
    setBusy(withAi ? "ai" : "blank");
    setError(null);
    try {
      let draft = { subject: name || "New campaign", preheader: "", content: { heading: "", paragraphs: [], ctaLabel: "", ctaUrl: "" }, isMock: false };
      if (withAi) draft = await apiRequest(`${base}/draft`, { method: "POST", body: { businessId, brief } });
      const c = await apiRequest(base, { method: "POST", body: { businessId, name: name || draft.subject.slice(0, 160) || "New campaign", subject: draft.subject || name, preheader: draft.preheader, content: draft.content } });
      router.push(`/automation/campaigns/${c.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(null);
    }
  }
  if (!businesses.length) return <p className="text-sm text-muted-foreground">Create a business first.</p>;
  return (
    <Card className="max-w-2xl gap-4">
      <h2 className="font-semibold">New campaign</h2>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label htmlFor="nc-business">Business</Label><NativeSelect id="nc-business" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</NativeSelect></div>
        <div className="grid gap-1.5"><Label htmlFor="nc-name">Campaign name</Label><Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="e.g. Rye is back" /></div>
      </div>
      <div className="grid gap-1.5"><Label htmlFor="nc-brief">What is the email about?</Label><Textarea id="nc-brief" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Seeded rye returns this Saturday; small batch; come early." /><p className="text-xs text-muted-foreground">Offers and dates are only used if you write them here.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy !== null || brief.trim().length < 5 || !ai.configured} onClick={() => create(true)}>{busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} Write with AI</Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => create(false)}>{busy === "blank" && <Loader2 className="animate-spin" />} Start blank</Button>
      </div>
    </Card>
  );
}

export function CampaignEditor({ workspaceId, initialCampaign, mode }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [form, setForm] = useState(toForm(initialCampaign));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 86400000); d.setMinutes(0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  const [previewKey, setPreviewKey] = useState(0);
  const [previewHtml, setPreviewHtml] = useState("");
  const base = `/api/v1/workspaces/${workspaceId}/automation`;

  // The saved email is fetched as HTML and shown in a fully sandboxed frame (no scripts, no same-origin access).
  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/campaigns/${initialCampaign.id}/preview`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((html) => !cancelled && setPreviewHtml(html))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [base, initialCampaign.id, previewKey]);
  const editable = campaign.status === "DRAFT" && campaign.permissions.canEdit;
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(campaign));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function run(key, fn) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
      setErrors(e.details ?? {});
    } finally {
      setBusy(null);
    }
  }
  const save = () => run("save", async () => { const c = await apiRequest(`${base}/campaigns/${campaign.id}`, { method: "PUT", body: toBody(form) }); setCampaign(c); setForm(toForm(c)); setErrors({}); setPreviewKey((k) => k + 1); setMessage("Saved."); });
  const err = (k) => errors[k]?.[0] ?? errors[`content.${k}`]?.[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/automation/campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Email campaigns</Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{campaign.business.name} · {campaign.recipients} subscribed recipient{campaign.recipients === 1 ? "" : "s"} <Badge variant={campaign.status === "SENT" ? "success" : "secondary"}>{campaign.status.toLowerCase()}</Badge> {campaign.isMock && <Badge variant="warning">Mock</Badge>}</p>
          {campaign.status === "SENT" && <p className="text-sm">Sent to {campaign.sentCount}{campaign.failedCount ? `, ${campaign.failedCount} failed` : ""}{campaign.sentAt ? ` on ${new Date(campaign.sentAt).toLocaleString()}` : ""}.</p>}
        </div>
        {editable && <Button disabled={!dirty || busy !== null} onClick={save}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save" : "Saved"}</Button>}
      </div>
      {campaign.provider === "console" && <Alert variant="info"><Info /><AlertDescription>Development email provider: emails are written to the server log, not delivered. Configure an email provider (e.g. Resend) for real sending.</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset disabled={!editable} className="space-y-4">
          <Card className="gap-4">
            <div className="grid gap-1.5"><Label htmlFor="c-name">Name (internal)</Label><Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={160} /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-subject">Subject line</Label><Input id="c-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} maxLength={200} aria-invalid={Boolean(err("subject")) || undefined} />{err("subject") && <p className="text-xs font-medium text-destructive">{err("subject")}</p>}<p className="text-xs text-muted-foreground">{form.subject.length}/60 recommended</p></div>
            <div className="grid gap-1.5"><Label htmlFor="c-pre">Preview text</Label><Input id="c-pre" value={form.preheader} onChange={(e) => set("preheader", e.target.value)} maxLength={200} /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-heading">Heading</Label><Input id="c-heading" value={form.heading} onChange={(e) => set("heading", e.target.value)} maxLength={160} /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-body">Message (blank line between paragraphs)</Label><Textarea id="c-body" rows={8} value={form.body} onChange={(e) => set("body", e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="c-cta">Button text</Label><Input id="c-cta" value={form.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} maxLength={40} /></div>
              <div className="grid gap-1.5"><Label htmlFor="c-url">Button link</Label><Input id="c-url" value={form.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="https://" aria-invalid={Boolean(err("ctaUrl")) || undefined} />{err("ctaUrl") && <p className="text-xs font-medium text-destructive">{err("ctaUrl")}</p>}</div>
            </div>
          </Card>
        </fieldset>
        <div className="space-y-4">
          <Card className="gap-3 p-3">
            <p className="px-1 text-sm font-medium">Preview</p>
            <iframe title="Email preview" srcDoc={previewHtml} sandbox="" className="h-[520px] w-full rounded-lg border bg-white" />
          </Card>
          {campaign.permissions.canEdit && (
            <Card className="gap-3">
              <h2 className="font-semibold">Send</h2>
              <Button variant="outline" className="w-fit" disabled={busy !== null || dirty} onClick={() => run("test", async () => { const r = await apiRequest(`${base}/campaigns/${campaign.id}/test`, { method: "POST" }); setMessage(`Test sent to ${r.sentTo}${r.provider === "console" ? " (logged by the development provider)" : ""}.`); })}><Mail /> Send me a test</Button>
              {campaign.status === "DRAFT" && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-1.5"><Label htmlFor="c-when">Send at</Label><Input id="c-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
                  <Button disabled={busy !== null || dirty || campaign.recipients === 0} onClick={() => run("schedule", async () => { await apiRequest(`${base}/items`, { method: "POST", body: { businessId: campaign.businessId, sourceType: "EMAIL_CAMPAIGN", sourceId: campaign.id, scheduledAt: new Date(when).toISOString(), submit: true } }); router.push("/automation/queue"); })}>{busy === "schedule" ? <Loader2 className="animate-spin" /> : <CalendarPlus />} Schedule send</Button>
                </div>
              )}
              {campaign.recipients === 0 && <p className="text-sm text-muted-foreground">Add contacts in <Link className="underline" href="/automation/audience">Audience</Link> first.</p>}
              <p className="text-xs text-muted-foreground">{mode === "DRAFT_ONLY" ? "Draft-only mode: at the scheduled time an owner/admin is reminded and sends it with “Send now”." : mode === "APPROVAL_REQUIRED" ? "Approval required: an owner/admin approves it before it is sent." : "Authorized automation: it is sent at the scheduled time within your daily email limit."} Every email includes your address and an unsubscribe link.</p>
            </Card>
          )}
          {editable && <Button variant="ghost" className="text-destructive" disabled={busy !== null} onClick={() => run("delete", async () => { await apiRequest(`${base}/campaigns/${campaign.id}`, { method: "DELETE" }); router.push("/automation/campaigns"); })}><Trash2 /> Delete campaign</Button>}
        </div>
      </div>
    </div>
  );
}
