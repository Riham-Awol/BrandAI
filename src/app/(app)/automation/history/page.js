import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listHistory } from "@/modules/automation/history.js";
import { OUTCOME_LABELS } from "@/modules/automation/catalog.js";
import { cn } from "@/lib/utils";

export const metadata = { title: "Automation history" };

const VARIANT = { SUCCESS: "success", SKIPPED: "secondary", BLOCKED: "warning", FAILED: "warning" };

export default function HistoryPage({ searchParams }) {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><History searchParams={searchParams} /></Suspense>;
}

async function History({ searchParams }) {
  const { outcome } = await searchParams;
  const user = await requireUserOrRedirect("/automation/history");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const filter = OUTCOME_LABELS[outcome] ? outcome : undefined;
  const runs = await listHistory(user, active.id, { outcome: filter });
  return (
    <div className="space-y-4">
      <nav aria-label="Filter history" className="flex flex-wrap gap-1">
        {[["", "All"], ...Object.entries(OUTCOME_LABELS)].map(([k, l]) => (
          <Link key={k} href={k ? `/automation/history?outcome=${k}` : "/automation/history"} aria-current={(filter ?? "") === k ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 text-sm", (filter ?? "") === k ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{l}</Link>
        ))}
      </nav>
      {runs.length === 0 ? <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No automation activity yet.</p> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Automation history</caption>
            <thead className="border-b text-left text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">When</th><th scope="col" className="px-4 py-3 font-medium">What</th><th scope="col" className="px-4 py-3 font-medium">Outcome</th><th scope="col" className="px-4 py-3 font-medium">Details</th></tr></thead>
            <tbody className="divide-y">
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                  <td className="px-4 py-3 capitalize">{r.kind.replace("_", " ")}</td>
                  <td className="px-4 py-3"><Badge variant={VARIANT[r.outcome]}>{OUTCOME_LABELS[r.outcome]}</Badge></td>
                  <td className="px-4 py-3">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
