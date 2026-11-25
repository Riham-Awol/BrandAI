"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Search } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function AdminWorkspaces({ initial }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ plan: "FREE", note: "", amount: "", creditNote: "" });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const search = async (query = q) => setRows(await apiRequest(`/api/v1/admin/workspaces?q=${encodeURIComponent(query)}`));

  async function act(key, fn, done) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      await search();
      setMessage(done);
    } catch (e) {
      setError(e.details ? Object.values(e.details).flat()[0] ?? e.message : e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <Input aria-label="Search workspaces" placeholder="Name, owner email or id" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="outline"><Search /> Search</Button>
      </form>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <p role="status" className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />{message}</p>}
      <ul className="grid gap-2">
        {rows.map((w) => (
          <li key={w.id}>
            <Card className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{w.name} <Badge>{w.type.toLowerCase()}</Badge> <Badge variant="secondary">{w.plan}{w.source === "ADMIN" ? " (admin)" : ""}</Badge> {w.isClient && <Badge variant="secondary">client</Badge>} {w.suspended && <Badge variant="warning">Suspended</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{w.owner} · {w.members} members · {w.businesses} businesses · created {new Date(w.createdAt).toLocaleDateString()} · <span className="font-mono">{w.id}</span></p>
                </div>
                <Button size="sm" variant="outline" aria-expanded={open === w.id} onClick={() => { setOpen(open === w.id ? null : w.id); setForm({ plan: w.plan, note: "", amount: "", creditNote: "" }); }}>Manage</Button>
              </div>
              {open === w.id && (
                <div className="grid gap-4 border-t pt-3 md:grid-cols-3">
                  {!w.isClient && (
                    <div className="grid content-start gap-2">
                      <Label htmlFor={`p-${w.id}`}>Plan</Label>
                      <NativeSelect id={`p-${w.id}`} value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}>{["FREE", "PRO", "AGENCY"].map((p) => <option key={p}>{p}</option>)}</NativeSelect>
                      <Input aria-label="Plan note" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                      <Button size="sm" disabled={busy !== null} onClick={() => act("plan", () => apiRequest(`/api/v1/admin/workspaces/${w.id}/plan`, { method: "PUT", body: { plan: form.plan, note: form.note || undefined } }), "Plan updated.")}>Set plan</Button>
                    </div>
                  )}
                  <div className="grid content-start gap-2">
                    <Label htmlFor={`c-${w.id}`}>Extra AI credits{w.isClient ? " (agency pool)" : ""}</Label>
                    <Input id={`c-${w.id}`} type="number" placeholder="e.g. 200 or -50" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                    <Input aria-label="Reason for credits" placeholder="Reason (shown in the ledger)" value={form.creditNote} onChange={(e) => setForm((f) => ({ ...f, creditNote: e.target.value }))} />
                    <Button size="sm" disabled={busy !== null || !form.amount} onClick={() => act("credits", () => apiRequest(`/api/v1/admin/workspaces/${w.id}/credits`, { method: "POST", body: { amount: form.amount, note: form.creditNote } }), "Credits updated.")}>Apply</Button>
                  </div>
                  <div className="grid content-start gap-2">
                    <p className="text-sm font-medium">Access</p>
                    <p className="text-xs text-muted-foreground">Suspending blocks every member from this workspace until restored.</p>
                    <Button size="sm" variant={w.suspended ? "outline" : "destructive"} disabled={busy !== null} onClick={() => act("susp", () => apiRequest(`/api/v1/admin/workspaces/${w.id}/suspend`, { method: "PUT", body: { suspended: !w.suspended } }), w.suspended ? "Workspace restored." : "Workspace suspended.")}>{w.suspended ? "Restore" : "Suspend"}</Button>
                  </div>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No matching workspaces.</p>}
    </div>
  );
}
