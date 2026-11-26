"use client";

import { useState } from "react";
import { AlertCircle, Brain, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";

/** What the AI has learned from approved results, with controls to forget it or switch learning off. */
export function AiMemory({ workspaceId, initial }) {
  const [data, setData] = useState(initial);
  const [businessId, setBusinessId] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}/ai-memory`;
  const names = Object.fromEntries(data.businesses.map((b) => [b.id, b.name]));
  const load = async (b = businessId) => setData(await apiRequest(`${base}${b ? `?businessId=${b}` : ""}`));

  async function run(key, fn, done) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      if (done) setMessage(done);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <Card className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold"><Brain className="size-4" /> Learning from your approvals</h2>
          {data.enabled ? <Badge variant="success">On</Badge> : <Badge>Off</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">When you accept a result in a studio or mark a social post as ready, Brand AI keeps it as an example for that business. Next time, the AI sees your latest approved examples for the same task and follows their style. It never trains a model or shares examples outside this workspace.</p>
        {data.permissions.canToggle && (
          <Button variant="outline" className="w-fit" disabled={busy !== null} onClick={() => run("toggle", async () => { await apiRequest(`${base}/settings`, { method: "PUT", body: { enabled: !data.enabled } }); await load(); }, data.enabled ? "Learning is off. Saved examples are no longer used." : "Learning is on.")}>
            {busy === "toggle" && <Loader2 className="animate-spin" />} {data.enabled ? "Turn learning off" : "Turn learning on"}
          </Button>
        )}
      </Card>

      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <p role="status" className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />{message}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <NativeSelect aria-label="Business" className="w-auto min-w-48" value={businessId} onChange={(e) => { setBusinessId(e.target.value); run("load", () => load(e.target.value)); }}>
          <option value="">All businesses</option>
          {data.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </NativeSelect>
        {data.permissions.canEdit && data.examples.length > 0 && (
          <Button variant="ghost" disabled={busy !== null} onClick={() => run("clear", async () => { const r = await apiRequest(`${base}${businessId ? `?businessId=${businessId}` : ""}`, { method: "DELETE" }); await load(); setMessage(`Forgot ${r.deleted} example${r.deleted === 1 ? "" : "s"}.`); })}><Trash2 /> Forget {businessId ? "this business's" : "all"} examples</Button>
        )}
      </div>

      {data.examples.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Nothing learned yet. Accept a result in any studio, or mark a social post as ready, and it will appear here.</p>
      ) : (
        <ul className="grid gap-3">
          {data.examples.map((e) => (
            <li key={e.id}>
              <Card className="gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{e.label} <Badge variant="secondary">{e.source === "EDITED" ? "Edited, then approved" : "Approved"}</Badge></p>
                    <p className="text-xs text-muted-foreground">{names[e.businessId] ?? "Business"} · {new Date(e.updatedAt).toLocaleString()}</p>
                  </div>
                  {data.permissions.canEdit && <Button size="icon" variant="ghost" aria-label={`Forget ${e.label}`} disabled={busy !== null} onClick={() => run(`d-${e.id}`, async () => { await apiRequest(`${base}/${e.id}`, { method: "DELETE" }); await load(); }, "Example forgotten.")}><Trash2 /></Button>}
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-3 text-xs">{e.preview}</pre>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
