"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Platform-wide audit trail with filters. */
export function AdminAudit({ initial }) {
  const [f, setF] = useState({ action: "", actor: "", workspaceId: "" });
  const [entries, setEntries] = useState(initial.entries);
  const [next, setNext] = useState(initial.nextBefore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function load(before) {
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams(Object.entries({ ...f, ...(before ? { before } : {}) }).filter(([, v]) => v));
      const r = await apiRequest(`/api/v1/admin/audit?${q}`);
      setEntries((e) => (before ? [...e, ...r.entries] : r.entries));
      setNext(r.nextBefore);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <Input aria-label="Action starts with" placeholder="Action (e.g. platform.)" value={f.action} onChange={(e) => setF((x) => ({ ...x, action: e.target.value }))} />
        <Input aria-label="Actor email" placeholder="Actor email" value={f.actor} onChange={(e) => setF((x) => ({ ...x, actor: e.target.value }))} />
        <Input aria-label="Workspace id" placeholder="Workspace id" value={f.workspaceId} onChange={(e) => setF((x) => ({ ...x, workspaceId: e.target.value }))} />
        <Button type="submit" variant="outline"><Search /> Filter</Button>
      </form>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      <Card className="gap-0 overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Platform audit log</caption>
          <thead className="text-left text-muted-foreground"><tr><th scope="col" className="px-4 py-2 font-medium">When</th><th scope="col" className="px-4 py-2 font-medium">Who</th><th scope="col" className="px-4 py-2 font-medium">What</th><th scope="col" className="px-4 py-2 font-medium">Workspace</th><th scope="col" className="px-4 py-2 font-medium">IP</th><th scope="col" className="px-4 py-2 font-medium">Details</th></tr></thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2">{e.actor}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.workspaceId?.slice(0, 8) ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{e.ipAddress ?? "—"}</td>
                <td className="max-w-64 truncate px-4 py-2 text-xs text-muted-foreground" title={e.metadata ? JSON.stringify(e.metadata) : ""}>{e.metadata ? JSON.stringify(e.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing matches.</p>}
      </Card>
      {next && <Button variant="outline" className="w-fit" disabled={busy} onClick={() => load(next)}>{busy && <Loader2 className="animate-spin" />} Load older</Button>}
    </div>
  );
}
