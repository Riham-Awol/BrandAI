"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, Play, Plug, ShieldCheck, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { INTEGRATIONS, MODES, UNSUPPORTED_CHANNELS } from "../catalog.js";

export function SettingsPanel({ workspaceId, initialSettings, initialIntegrations }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [form, setForm] = useState({ mode: initialSettings.mode, dailyPublishLimit: initialSettings.dailyPublishLimit, dailyEmailLimit: initialSettings.dailyEmailLimit, requireSeparateApprover: initialSettings.requireSeparateApprover, timezone: initialSettings.timezone });
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [newType, setNewType] = useState("WEBHOOK");
  const [newFields, setNewFields] = useState({ name: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [reveal, setReveal] = useState(null);
  const [tests, setTests] = useState({});
  const base = `/api/v1/workspaces/${workspaceId}/automation`;
  const { canManage, canEnableAutopilot } = settings.permissions;

  async function run(key, fn) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
      setFieldErrors(e.details ?? {});
    } finally {
      setBusy(null);
    }
  }

  const dirty = JSON.stringify(form) !== JSON.stringify({ mode: settings.mode, dailyPublishLimit: settings.dailyPublishLimit, dailyEmailLimit: settings.dailyEmailLimit, requireSeparateApprover: settings.requireSeparateApprover, timezone: settings.timezone });

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <p role="status" className="text-sm text-success">{message}</p>}

      <Card className="gap-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> How automation may act</h2>
        <fieldset disabled={!canManage} className="space-y-3">
          <legend className="sr-only">Automation mode</legend>
          <div role="radiogroup" aria-label="Automation mode" className="grid gap-3 md:grid-cols-3">
            {Object.entries(MODES).map(([key, m]) => {
              const locked = key === "AUTOMATED" && settings.mode !== "AUTOMATED" && !canEnableAutopilot;
              return (
                <button key={key} type="button" role="radio" aria-checked={form.mode === key} disabled={locked} onClick={() => setForm((f) => ({ ...f, mode: key }))} className={cn("rounded-xl border p-4 text-left transition-colors disabled:opacity-60", form.mode === key ? "border-primary bg-accent/60 ring-1 ring-primary" : "hover:bg-accent/40")}>
                  <p className="font-semibold">{m.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{m.summary}</p>
                  {locked && <p className="mt-2 text-xs font-medium">Owner only</p>}
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5"><Label htmlFor="st-posts">Max automatic posts per 24 h</Label><Input id="st-posts" type="number" min={0} max={100} value={form.dailyPublishLimit} onChange={(e) => setForm((f) => ({ ...f, dailyPublishLimit: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label htmlFor="st-emails">Max emails per 24 h</Label><Input id="st-emails" type="number" min={0} max={5000} value={form.dailyEmailLimit} onChange={(e) => setForm((f) => ({ ...f, dailyEmailLimit: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label htmlFor="st-tz">Time zone</Label><Input id="st-tz" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} /></div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={form.requireSeparateApprover} onChange={(e) => setForm((f) => ({ ...f, requireSeparateApprover: e.target.checked }))} /> Approver must be a different person</label>
          </div>
          <p className="text-xs text-muted-foreground">Spending: Brand AI takes no paid actions (no ads or purchases), so there is no spending limit to set.</p>
        </fieldset>
        {canManage ? (
          <Button className="w-fit" disabled={!dirty || busy !== null} onClick={() => run("save", async () => { const s = await apiRequest(`${base}/settings`, { method: "PUT", body: { ...form, dailyPublishLimit: Number(form.dailyPublishLimit), dailyEmailLimit: Number(form.dailyEmailLimit) } }); setSettings(s); setMessage("Automation settings saved."); router.refresh(); })}>
            {busy === "save" && <Loader2 className="animate-spin" />} Save settings
          </Button>
        ) : <p className="text-sm text-muted-foreground">Only owners and admins can change these settings.</p>}
      </Card>

      <Card className="gap-4">
        <h2 className="font-semibold">Server status</h2>
        <ul className="space-y-2 text-sm">
          <Status ok={settings.platform.schedulerConfigured} label="Scheduler" good="Configured (CRON_SECRET) — call POST /api/v1/cron/run every 5–15 minutes." bad="Not configured: set CRON_SECRET and call POST /api/v1/cron/run on a schedule. You can still use “Run now”." />
          <Status ok={settings.platform.emailDelivers} label="Email" good={`Sending through ${settings.platform.emailProvider}.`} bad={settings.platform.emailProvider === "console" ? "Development provider: emails are written to the server log, not delivered." : "Not configured: campaigns can't be delivered."} />
          <Status ok={settings.platform.encryptionConfigured} label="Channel credentials" good="Encrypted at rest (AES-256-GCM)." bad="INTEGRATIONS_ENCRYPTION_KEY is not set: channels can't be connected." />
        </ul>
        {canManage && (
          <Button variant="outline" className="w-fit" disabled={busy !== null} onClick={() => run("run", async () => { const r = await apiRequest(`${base}/run`, { method: "POST" }); setMessage(r.skipped ? r.reason : `Run complete: ${r.published} published, ${r.manual} to post manually, ${r.blocked} blocked, ${r.postponed} postponed, ${r.failed} failed, ${r.reminders} reminders.`); })}>
            {busy === "run" ? <Loader2 className="animate-spin" /> : <Play />} Run now
          </Button>
        )}
      </Card>

      <Card className="gap-4">
        <h2 className="flex items-center gap-2 font-semibold"><Plug className="size-4" /> Channels</h2>
        {reveal && (
          <Alert variant="info"><Info /><AlertTitle>Webhook signing secret — copy it now</AlertTitle><AlertDescription><p>Brand AI signs each request with HMAC-SHA256 in the <code>X-BrandAI-Signature</code> header (over <code>timestamp.body</code>). This secret is shown only once:</p><code className="mt-1 block break-all rounded bg-background p-2">{reveal}</code></AlertDescription></Alert>
        )}
        {integrations.length === 0 ? <p className="text-sm text-muted-foreground">No channels connected. Without a channel, scheduled posts remind you to post them yourself.</p> : (
          <ul className="divide-y">
            {integrations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{i.name} <Badge variant={i.status === "ACTIVE" ? "success" : i.status === "ERROR" ? "warning" : "secondary"} className="ml-1">{i.status === "ACTIVE" ? "Active" : i.status === "ERROR" ? "Error" : "Disabled"}</Badge></p>
                  <p className="text-xs text-muted-foreground">{INTEGRATIONS[i.type].label} · {Object.values(i.config).join(" · ")}{i.lastUsedAt ? ` · last used ${new Date(i.lastUsedAt).toLocaleString()}` : ""}</p>
                  {i.lastError && <p className="text-xs text-destructive">{i.lastError}</p>}
                  {tests[i.id] && <p className={cn("text-xs", tests[i.id].ok ? "text-success" : "text-destructive")}>{tests[i.id].ok ? `Test succeeded${tests[i.id].ref ? ` (${tests[i.id].ref})` : ""}.` : tests[i.id].error}</p>}
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(`t-${i.id}`, async () => { const r = await apiRequest(`${base}/integrations/${i.id}/test`, { method: "POST" }); setTests((t) => ({ ...t, [i.id]: r })); setIntegrations(await apiRequest(`${base}/integrations`)); })}>{busy === `t-${i.id}` && <Loader2 className="animate-spin" />} Test</Button>
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(`e-${i.id}`, async () => setIntegrations(await apiRequest(`${base}/integrations/${i.id}`, { method: "PATCH", body: { enabled: i.status === "DISABLED" } })))}>{i.status === "DISABLED" ? "Enable" : "Disable"}</Button>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${i.name}`} disabled={busy !== null} onClick={() => run(`d-${i.id}`, async () => { await apiRequest(`${base}/integrations/${i.id}`, { method: "DELETE" }); setIntegrations(await apiRequest(`${base}/integrations`)); })}><Trash2 /></Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <form className="space-y-3 rounded-xl border p-4" onSubmit={(e) => { e.preventDefault(); run("connect", async () => { const created = await apiRequest(`${base}/integrations`, { method: "POST", body: { type: newType, ...newFields } }); setReveal(created.reveal?.signingSecret ?? null); setNewFields({ name: "" }); setFieldErrors({}); setIntegrations(await apiRequest(`${base}/integrations`)); setMessage(`Connected “${created.name}”. Use Test to check it.`); }); }}>
            <p className="text-sm font-medium">Connect a channel</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="i-type">Type</Label><NativeSelect id="i-type" value={newType} onChange={(e) => { setNewType(e.target.value); setNewFields({ name: "" }); }}>{Object.entries(INTEGRATIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</NativeSelect></div>
              <div className="grid gap-1.5"><Label htmlFor="i-name">Name</Label><Input id="i-name" value={newFields.name} onChange={(e) => setNewFields((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Bakery channel" /></div>
              {INTEGRATIONS[newType].fields.map((f) => (
                <div key={f.key} className="grid gap-1.5">
                  <Label htmlFor={`i-${f.key}`}>{f.label}</Label>
                  <Input id={`i-${f.key}`} type={f.secret ? "password" : "text"} autoComplete="off" value={newFields[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setNewFields((x) => ({ ...x, [f.key]: e.target.value }))} aria-invalid={Boolean(fieldErrors[f.key]) || undefined} />
                  {fieldErrors[f.key] && <p className="text-xs font-medium text-destructive">{fieldErrors[f.key][0]}</p>}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{INTEGRATIONS[newType].description} Credentials are encrypted and never shown again.</p>
            <Button type="submit" disabled={busy !== null || !settings.platform.encryptionConfigured}>{busy === "connect" && <Loader2 className="animate-spin" />} Connect</Button>
          </form>
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium">Not available yet</p>
          <ul className="space-y-1 text-sm text-muted-foreground">{UNSUPPORTED_CHANNELS.map((c) => <li key={c.name}><span className="font-medium text-foreground">{c.name}:</span> {c.reason} Use a webhook with Zapier, Make or n8n meanwhile.</li>)}</ul>
        </div>
      </Card>
    </div>
  );
}

function Status({ ok, label, good, bad }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />}
      <span><span className="font-medium">{label}:</span> {ok ? good : bad}</span>
    </li>
  );
}
