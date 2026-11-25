"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Plus, Users } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { switchWorkspaceAction } from "@/server/actions/workspace-actions.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const STATUS = { ACTIVE: ["Active", "success"], PAUSED: ["Paused", "warning"], ARCHIVED: ["Archived", "secondary"] };

/** Agency client list: each client has its own workspace. */
export function ClientsSettings({ workspaceId, initial }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [form, setForm] = useState({ name: "", contactName: "", contactEmail: "", notes: "" });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}/clients`;
  const reload = async () => setData(await apiRequest(base));

  async function run(key, fn, done) {
    setBusy(key);
    setError(null);
    setErrors({});
    setMessage(null);
    try {
      await fn();
      if (done) setMessage(done);
    } catch (e) {
      setError(e.message);
      setErrors(e.details ?? {});
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">Each client gets a separate workspace, so their businesses, brand and data never mix. Clients use this agency&apos;s {data.plan} plan and AI credits. {data.active} of {data.limit} client slots used.</p>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <p role="status" className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />{message}</p>}

      {data.canManage && (
        <Card className="gap-4">
          <h2 className="flex items-center gap-2 font-semibold"><Plus className="size-4" /> Add a client</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5"><Label htmlFor="cl-name">Client name</Label><Input id="cl-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-invalid={Boolean(errors.name) || undefined} />{errors.name && <p className="text-xs font-medium text-destructive">{errors.name[0]}</p>}</div>
            <div className="grid gap-1.5"><Label htmlFor="cl-contact">Contact name (optional)</Label><Input id="cl-contact" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label htmlFor="cl-email">Contact email (optional)</Label><Input id="cl-email" type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} />{errors.contactEmail && <p className="text-xs font-medium text-destructive">{errors.contactEmail[0]}</p>}</div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="cl-notes">Notes (optional)</Label><Textarea id="cl-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          <Button className="w-fit" disabled={busy !== null || form.name.trim().length < 2} onClick={() => run("add", async () => { await apiRequest(base, { method: "POST", body: form }); setForm({ name: "", contactName: "", contactEmail: "", notes: "" }); await reload(); }, "Client added with its own workspace.")}>{busy === "add" && <Loader2 className="animate-spin" />} Add client</Button>
        </Card>
      )}

      {data.clients.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No clients yet.</p>
      ) : (
        <ul className="grid gap-3">
          {data.clients.map((c) => (
            <li key={c.id}>
              <Card className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">{c.name} <Badge variant={STATUS[c.status][1]}>{STATUS[c.status][0]}</Badge></p>
                    <p className="text-sm text-muted-foreground">{[c.contactName, c.contactEmail].filter(Boolean).join(" · ") || "No contact yet"} · {c.businesses} businesses · {c.members} members · {c.aiRequestsThisMonth} AI requests this month</p>
                    {c.notes && <p className="mt-1 whitespace-pre-line text-sm">{c.notes}</p>}
                  </div>
                  {c.canOpen && c.status !== "ARCHIVED" && <Button size="sm" disabled={busy !== null} onClick={() => run(`o-${c.id}`, async () => { await switchWorkspaceAction(c.workspaceId); router.push("/dashboard"); router.refresh(); })}>Open workspace <ArrowRight /></Button>}
                </div>
                {data.canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <NativeSelect aria-label={`Status of ${c.name}`} className="h-9 w-36" value={c.status} disabled={busy !== null} onChange={(e) => run(`s-${c.id}`, async () => { await apiRequest(`${base}/${c.id}`, { method: "PATCH", body: { status: e.target.value } }); await reload(); }, "Client updated.")}>
                      {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                    </NativeSelect>
                    {c.status !== "ARCHIVED" && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(`t-${c.id}`, async () => { const r = await apiRequest(`${base}/${c.id}/share-team`, { method: "POST" }); await reload(); setMessage(r.added ? `${r.added} team member(s) added to ${c.name}.` : "Your team already has access."); })}><Users /> Give my team access</Button>}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">To give a client access, open their workspace and invite them in Settings → Team. They only ever see their own workspace. Archiving closes the workspace for everyone until it&apos;s restored.</p>
    </div>
  );
}
