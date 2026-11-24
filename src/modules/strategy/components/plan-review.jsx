"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/layout/error-state";
import { formatMoney } from "../budget.js";

export function PlanReview({ base, project }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState({ busy: false, message: null, error: null });

  useEffect(() => {
    apiRequest(`${base}/plan`).then(setData).catch((e) => setError(e.message));
  }, [base]);

  if (error) return <ErrorState description={error} />;
  if (!data) return <Skeleton className="h-96 w-full" />;
  const { draft, approved } = data;
  const budget = draft.data.budget;

  async function approve() {
    setStatus({ busy: true, message: null, error: null });
    try {
      const result = await apiRequest(`${base}/plan`, { method: "POST" });
      setData(await apiRequest(`${base}/plan`));
      setStatus({ busy: false, message: `Marketing plan version ${result.version} approved. Brand AI studios will now use it.`, error: null });
    } catch (e) {
      setStatus({ busy: false, message: null, error: e.message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold">Review & approve</h2>
        <p className="text-sm text-muted-foreground">Your plan is assembled from the accepted (or latest) version of each section.</p>
      </div>
      {approved && (
        <Alert variant="success">
          <ShieldCheck />
          <AlertTitle>Approved plan: version {approved.version}</AlertTitle>
          <AlertDescription>
            Approved {new Date(approved.approvedAt).toLocaleString()}. <Link className="font-semibold underline" href={`/businesses/${project.business.id}/marketing`}>Open the approved plan</Link>
          </AlertDescription>
        </Alert>
      )}
      {!draft.complete && <Alert variant="info"><AlertCircle /><AlertDescription>Generate these sections before approving: {draft.missing.join(", ")}.</AlertDescription></Alert>}
      {budget?.overBudget && <Alert variant="destructive"><AlertCircle /><AlertDescription>The budget allocation exceeds your stated monthly budget. You can still approve, but consider editing it first.</AlertDescription></Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Sections ready", `${Object.values(draft.data.sections).filter(Boolean).length} of 8`],
          ["Monthly budget", budget ? formatMoney(budget.totalMonthly, budget.currency) : "—"],
          ["KPIs", draft.data.sections.kpis ? draft.data.sections.kpis.kpis.length : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card p-4 shadow-soft"><p className="text-sm text-muted-foreground">{k}</p><p className="font-display text-2xl font-semibold">{v}</p></div>
        ))}
      </div>
      {draft.data.sections.strategy && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Core message</p>
          <p className="mt-1 font-display text-xl">{draft.data.sections.strategy.messagingFramework.coreMessage}</p>
          <p className="mt-3 text-sm">{draft.data.sections.strategy.executiveSummary}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild><a href={`${base}/export?format=markdown`} download><Download /> Plan (Markdown)</a></Button>
        <Button variant="outline" asChild><a href={`${base}/export?format=budget-csv`} download><Download /> Budget (CSV)</a></Button>
        <Button variant="outline" asChild><a href={`${base}/export?format=kpis-csv`} download><Download /> KPIs (CSV)</a></Button>
      </div>

      {status.error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{status.error}</AlertDescription></Alert>}
      {status.message && <Alert variant="success"><CheckCircle2 /><AlertDescription>{status.message}</AlertDescription></Alert>}
      <div className="flex justify-end">
        {project.permissions.canApprove ? (
          <Button size="lg" onClick={approve} disabled={!draft.complete || status.busy}><ShieldCheck /> {approved ? "Approve as new version" : "Approve marketing plan"}</Button>
        ) : (
          <p className="text-sm text-muted-foreground">A workspace admin or owner needs to approve the plan.</p>
        )}
      </div>
    </div>
  );
}
