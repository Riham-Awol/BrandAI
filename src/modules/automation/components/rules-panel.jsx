"use client";

import { useState } from "react";
import { AlertCircle, Bell, Check, Loader2, Plus, Trash2, Workflow } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RULE_TEMPLATES } from "../catalog.js";

export function RulesPanel({ workspaceId, initialRules, initialReminders, integrations, canManage, mode }) {
  const [rules, setRules] = useState(initialRules);
  const [reminders, setReminders] = useState(initialReminders);
  const [form, setForm] = useState({ template: "queue_ready_posts", name: RULE_TEMPLATES.queue_ready_posts.label, integrationId: "", time: "09:00" });
  const [rem, setRem] = useState({ title: "", dueAt: "", note: "" });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}/automation`;
  const t = RULE_TEMPLATES[form.template];
  const channels = integrations.filter((i) => (form.template === "forward_website_messages" ? i.type === "WEBHOOK" : true));

  async function run(key, fn) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  const reloadRules = async () => setRules(await apiRequest(`${base}/rules`));
  const reloadReminders = async () => setReminders(await apiRequest(`${base}/reminders`));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {error && <Alert variant="destructive" className="lg:col-span-2"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      <Card className="gap-4">
        <h2 className="flex items-center gap-2 font-semibold"><Workflow className="size-4" /> Automation rules</h2>
        <p className="text-sm text-muted-foreground">Preset recipes run by the scheduler. Anything they publish still follows your mode ({mode === "DRAFT_ONLY" ? "draft only" : mode === "APPROVAL_REQUIRED" ? "approval required" : "authorized automation"}).</p>
        {rules.length === 0 ? <p className="text-sm text-muted-foreground">No rules yet.</p> : (
          <ul className="divide-y">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.name} {!r.enabled && <Badge variant="secondary" className="ml-1">Off</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{RULE_TEMPLATES[r.template]?.description}{r.params?.time ? ` At ${r.params.time}.` : ""}</p>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(`t-${r.id}`, async () => { await apiRequest(`${base}/rules/${r.id}`, { method: "PATCH", body: { enabled: !r.enabled } }); await reloadRules(); })}>{r.enabled ? "Turn off" : "Turn on"}</Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${r.name}`} disabled={busy !== null} onClick={() => run(`d-${r.id}`, async () => { await apiRequest(`${base}/rules/${r.id}`, { method: "DELETE" }); await reloadRules(); })}><Trash2 /></Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-sm font-medium">Add a rule</p>
            <div className="grid gap-1.5"><Label htmlFor="r-template">Recipe</Label><NativeSelect id="r-template" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value, name: RULE_TEMPLATES[e.target.value].label, integrationId: "" })}>{Object.entries(RULE_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</NativeSelect><p className="text-xs text-muted-foreground">{t.description}</p></div>
            <div className="grid gap-1.5"><Label htmlFor="r-name">Name</Label><Input id="r-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={160} /></div>
            {t.params.includes("integrationId") && (
              <div className="grid gap-1.5"><Label htmlFor="r-channel">{form.template === "forward_website_messages" ? "Webhook" : "Publish to"}</Label><NativeSelect id="r-channel" value={form.integrationId} onChange={(e) => setForm({ ...form, integrationId: e.target.value })}>{form.template !== "forward_website_messages" && <option value="">None — remind me to post</option>}{form.template === "forward_website_messages" && <option value="">Choose a webhook…</option>}{channels.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></div>
            )}
            {t.params.includes("time") && <div className="grid max-w-40 gap-1.5"><Label htmlFor="r-time">Time of day</Label><Input id="r-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>}
            <Button disabled={busy !== null} onClick={() => run("add", async () => { await apiRequest(`${base}/rules`, { method: "POST", body: { ...form, integrationId: form.integrationId || null } }); await reloadRules(); })}>{busy === "add" ? <Loader2 className="animate-spin" /> : <Plus />} Add rule</Button>
          </div>
        ) : <p className="text-sm text-muted-foreground">Only owners and admins manage rules.</p>}
      </Card>

      <Card className="gap-4">
        <h2 className="flex items-center gap-2 font-semibold"><Bell className="size-4" /> My reminders</h2>
        <div className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="m-title">Reminder</Label><Input id="m-title" value={rem.title} onChange={(e) => setRem({ ...rem, title: e.target.value })} maxLength={200} placeholder="e.g. Order flour" /></div>
            <div className="grid gap-1.5"><Label htmlFor="m-due">When</Label><Input id="m-due" type="datetime-local" value={rem.dueAt} onChange={(e) => setRem({ ...rem, dueAt: e.target.value })} /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="m-note">Note (optional)</Label><Input id="m-note" value={rem.note} onChange={(e) => setRem({ ...rem, note: e.target.value })} maxLength={1000} /></div>
          <Button variant="outline" disabled={busy !== null || !rem.title || !rem.dueAt} onClick={() => run("rem", async () => { await apiRequest(`${base}/reminders`, { method: "POST", body: { ...rem, dueAt: new Date(rem.dueAt).toISOString() } }); setRem({ title: "", dueAt: "", note: "" }); await reloadReminders(); })}><Plus /> Add reminder</Button>
        </div>
        {reminders.length === 0 ? <p className="text-sm text-muted-foreground">No reminders.</p> : (
          <ul className="divide-y">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className={r.doneAt ? "opacity-60" : ""}><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{new Date(r.dueAt).toLocaleString()}{r.firedAt ? " · sent" : ""}{r.note ? ` · ${r.note}` : ""}</p></div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => run(`x-${r.id}`, async () => { await apiRequest(`${base}/reminders/${r.id}`, { method: "PATCH", body: { done: !r.doneAt } }); await reloadReminders(); })}><Check /> {r.doneAt ? "Undo" : "Done"}</Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete reminder ${r.title}`} disabled={busy !== null} onClick={() => run(`y-${r.id}`, async () => { await apiRequest(`${base}/reminders/${r.id}`, { method: "DELETE" }); await reloadReminders(); })}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
