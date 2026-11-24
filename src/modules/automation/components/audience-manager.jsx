"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Trash2, Upload, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";

/** Email audience per business. Every contact needs recorded consent. */
export function AudienceManager({ workspaceId, businesses }) {
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", consentSource: "", consentConfirmed: false });
  const [imp, setImp] = useState({ csv: "", consentSource: "", consentConfirmed: false });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}/automation/contacts`;

  const load = useCallback(async () => setData(await apiRequest(`${base}?businessId=${businessId}`)), [base, businessId]);
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    apiRequest(`${base}?businessId=${businessId}`).then((d) => !cancelled && setData(d)).catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [base, businessId]);

  async function run(key, fn) {
    setBusy(key);
    setError(null);
    setErrors({});
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

  if (!businesses.length) return <p className="text-sm text-muted-foreground">Create a business first.</p>;
  return (
    <div className="space-y-6">
      <div className="grid max-w-sm gap-1.5"><Label htmlFor="a-business">Business</Label><NativeSelect id="a-business" value={businessId} onChange={(e) => { setBusinessId(e.target.value); setData(null); }}>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</NativeSelect></div>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3">
          <h2 className="flex items-center gap-2 font-semibold"><UserPlus className="size-4" /> Add a contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="a-email">Email</Label><Input id="a-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} aria-invalid={Boolean(errors.email) || undefined} />{errors.email && <p className="text-xs font-medium text-destructive">{errors.email[0]}</p>}</div>
            <div className="grid gap-1.5"><Label htmlFor="a-name">Name (optional)</Label><Input id="a-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="a-consent">How did they agree?</Label><Input id="a-consent" value={form.consentSource} onChange={(e) => setForm((f) => ({ ...f, consentSource: e.target.value }))} placeholder="e.g. Signed up at the market stall" />{errors.consentSource && <p className="text-xs font-medium text-destructive">{errors.consentSource[0]}</p>}</div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={form.consentConfirmed} onChange={(e) => setForm((f) => ({ ...f, consentConfirmed: e.target.checked }))} /> This person agreed to receive marketing emails from this business.</label>
          {errors.consentConfirmed && <p className="text-xs font-medium text-destructive">{errors.consentConfirmed[0]}</p>}
          <Button className="w-fit" disabled={busy !== null} onClick={() => run("add", async () => { await apiRequest(base, { method: "POST", body: { ...form, businessId } }); setForm({ email: "", name: "", consentSource: form.consentSource, consentConfirmed: false }); setMessage("Contact added."); await load(); })}>{busy === "add" && <Loader2 className="animate-spin" />} Add contact</Button>
        </Card>
        <Card className="gap-3">
          <h2 className="flex items-center gap-2 font-semibold"><Upload className="size-4" /> Import a CSV</h2>
          <div className="grid gap-1.5"><Label htmlFor="a-file">CSV file (an “email” column, optional “name”)</Label><Input id="a-file" type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const csv = f.size > 1_000_000 ? "" : await f.text(); setImp((x) => ({ ...x, csv })); }} />{imp.csv && <p className="text-xs text-muted-foreground">{imp.csv.split(/\r?\n/).filter(Boolean).length} lines loaded.</p>}{errors.csv && <p className="text-xs font-medium text-destructive">{errors.csv[0]}</p>}</div>
          <div className="grid gap-1.5"><Label htmlFor="a-iconsent">How did they agree?</Label><Input id="a-iconsent" value={imp.consentSource} onChange={(e) => setImp((x) => ({ ...x, consentSource: e.target.value }))} placeholder="e.g. Newsletter sign-up form" /></div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={imp.consentConfirmed} onChange={(e) => setImp((x) => ({ ...x, consentConfirmed: e.target.checked }))} /> Everyone in this file agreed to receive marketing emails from this business.</label>
          <Button className="w-fit" variant="outline" disabled={busy !== null || !imp.csv} onClick={() => run("import", async () => { const r = await apiRequest(`${base}/import`, { method: "POST", body: { ...imp, businessId } }); setMessage(`Imported ${r.added}; skipped ${r.skipped} already in your audience (including unsubscribed); ${r.invalid} invalid.`); setImp({ csv: "", consentSource: imp.consentSource, consentConfirmed: false }); await load(); })}>{busy === "import" && <Loader2 className="animate-spin" />} Import</Button>
        </Card>
      </div>
      {data === null ? <Skeleton className="h-48" /> : (
        <Card className="gap-3 overflow-x-auto">
          <p className="text-sm"><span className="font-semibold">{data.subscribed}</span> subscribed of {data.total} contacts</p>
          {data.contacts.length === 0 ? <p className="text-sm text-muted-foreground">No contacts yet.</p> : (
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Contacts</caption>
              <thead className="text-left text-muted-foreground"><tr><th scope="col" className="py-2 font-medium">Email</th><th scope="col" className="py-2 font-medium">Name</th><th scope="col" className="py-2 font-medium">Consent</th><th scope="col" className="py-2 font-medium">Status</th><th scope="col" className="py-2"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y">
                {data.contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2">{c.email}</td><td className="py-2">{c.name ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{c.consentSource} · {new Date(c.consentAt).toLocaleDateString()}</td>
                    <td className="py-2">{c.unsubscribedAt ? <Badge variant="secondary">Unsubscribed</Badge> : <Badge variant="success">Subscribed</Badge>}</td>
                    <td className="py-2 text-right"><Button size="icon" variant="ghost" aria-label={`Delete ${c.email}`} disabled={busy !== null} onClick={() => run(`d-${c.id}`, async () => { await apiRequest(`${base}/${c.id}`, { method: "DELETE" }); await load(); })}><Trash2 /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
