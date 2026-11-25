"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronDown, FileText, Printer, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InsightsView } from "./insights-view";

/** Saved performance reports: the metrics snapshot plus the AI insights of that moment. */
export function ReportsList({ workspaceId, initialReports, canDelete }) {
  const [reports, setReports] = useState(initialReports);
  const [open, setOpen] = useState(initialReports[0]?.id ?? null);
  const [error, setError] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}/analytics/reports`;

  async function remove(id) {
    setError(null);
    try {
      await apiRequest(`${base}/${id}`, { method: "DELETE" });
      setReports((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  if (!reports.length) return <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No saved reports yet. Use “Get insights” on the overview to create one.</p>;
  return (
    <div className="space-y-3">
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {reports.map((r) => (
        <Card key={r.id} className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="flex min-w-0 items-center gap-2 text-left" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
              <ChevronDown className={`size-4 shrink-0 transition-transform ${open === r.id ? "" : "-rotate-90"}`} aria-hidden="true" />
              <span className="font-semibold">Last {r.periodDays} days · {r.business ?? "All businesses"}</span>
              <span className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
              {r.isMock && <Badge>Mock</Badge>}
            </button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild><Link href={`/print/analytics/${r.id}`}><Printer /> Print</Link></Button>
              <Button variant="outline" size="sm" asChild><a href={`${base}/${r.id}/export?format=md`} download><FileText /> Markdown</a></Button>
              <Button variant="outline" size="sm" asChild><a href={`${base}/${r.id}/export?format=csv`} download>CSV</a></Button>
              {canDelete && <Button variant="ghost" size="icon" aria-label="Delete report" onClick={() => remove(r.id)}><Trash2 /></Button>}
            </div>
          </div>
          {open === r.id && <InsightsView insights={r.insights} metrics={r.metrics} isMock={r.isMock} />}
        </Card>
      ))}
    </div>
  );
}
