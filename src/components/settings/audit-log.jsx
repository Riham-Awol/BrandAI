"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";

const FILTERS = [["", "Everything"], ["member.", "Team"], ["workspace.", "Workspace"], ["billing.", "Billing"], ["business", "Businesses"], ["ai.", "AI"], ["automation.", "Automation"], ["website.", "Websites"], ["analytics.", "Analytics"], ["agency.", "Clients"], ["file.", "Files"]];

/** Who did what, when (admins and the owner). */
export function AuditLog({ workspaceId, initial }) {
  const [filter, setFilter] = useState("");
  const [entries, setEntries] = useState(initial.entries);
  const [next, setNext] = useState(initial.nextBefore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}/audit`;

  async function load(f, before) {
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams({ ...(f ? { action: f } : {}), ...(before ? { before } : {}) });
      const r = await apiRequest(`${base}?${q}`);
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
      <NativeSelect aria-label="Filter" className="w-auto max-w-xs" value={filter} onChange={(e) => { setFilter(e.target.value); load(e.target.value); }}>
        {FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </NativeSelect>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      <Card className="gap-0 overflow-x-auto p-0">
        {entries.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</p> : (
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Audit log</caption>
            <thead className="text-left text-muted-foreground"><tr><th scope="col" className="px-4 py-2 font-medium">When</th><th scope="col" className="px-4 py-2 font-medium">Who</th><th scope="col" className="px-4 py-2 font-medium">What</th><th scope="col" className="px-4 py-2 font-medium">Details</th></tr></thead>
            <tbody className="divide-y">
              {entries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">{e.actor}</td>
                  <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                  <td className="max-w-72 truncate px-4 py-2 text-xs text-muted-foreground" title={e.metadata ? JSON.stringify(e.metadata) : ""}>{e.metadata ? JSON.stringify(e.metadata) : e.entityType ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {next && <Button variant="outline" className="w-fit" disabled={busy} onClick={() => load(filter, next)}>{busy && <Loader2 className="animate-spin" />} Load older</Button>}
    </div>
  );
}
