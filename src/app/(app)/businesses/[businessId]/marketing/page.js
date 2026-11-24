import Link from "next/link";
import { Suspense } from "react";
import { Download, Target } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getCurrentPlan } from "@/modules/strategy/plan-service.js";
import { PlanDocument } from "@/modules/strategy/components/plan-document";
import { PrintButton } from "@/components/layout/print-button";

export const metadata = { title: "Marketing plan" };

export default function MarketingPlanPage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-72" /><Skeleton className="h-96 w-full" /></div>}>
      <Plan params={params} />
    </Suspense>
  );
}

async function Plan({ params }) {
  const { businessId } = await params;
  const user = await requireUserOrRedirect(`/businesses/${businessId}/marketing`);
  const { active } = await getActiveWorkspace(user.id);
  const { business, plan } = await loadOr404(() => getCurrentPlan(user, active?.id, businessId));
  if (!plan) {
    return (
      <EmptyState
        icon={Target}
        title="No approved marketing plan yet"
        description="Create and approve a plan in the Marketing Strategy Studio."
        action={<Button asChild><Link href={`/strategy/new?business=${businessId}`}>Open Marketing Strategy Studio</Link></Button>}
      />
    );
  }
  const exportBase = `/api/v1/workspaces/${active.id}/businesses/${businessId}/marketing-plan/export`;
  return (
    <article className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={`Marketing plan · version ${plan.version}`}
        title={business.name}
        description={`Approved ${new Date(plan.approvedAt).toLocaleDateString()}`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton />
            <Button variant="outline" asChild><a href={`${exportBase}?format=markdown`} download><Download /> Markdown</a></Button>
            <Button variant="outline" asChild><a href={`${exportBase}?format=budget-csv`} download><Download /> Budget CSV</a></Button>
            {plan.projectId && <Button variant="outline" asChild><Link href={`/strategy/${plan.projectId}`}>Edit in studio</Link></Button>}
          </div>
        }
      />
      <Badge variant="success" className="print:hidden">Approved — used by every Brand AI studio</Badge>
      <PlanDocument data={plan.data} />
    </article>
  );
}
