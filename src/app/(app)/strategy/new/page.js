import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { NewStrategyForm } from "@/modules/strategy/components/new-strategy-form";

export const metadata = { title: "New marketing strategy" };

export default function NewStrategyPage({ searchParams }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Marketing Strategy Studio" title="Plan your marketing" description="Set your goal and budget. Your business profile and brand are reused automatically." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }) {
  const { business } = await searchParams;
  const user = await requireUserOrRedirect("/strategy/new");
  const { active } = await getActiveWorkspace(user.id);
  if (!active || active.role === "VIEWER") return <EmptyState icon={Lock} title="View-only access" description="You need editor access in this workspace to create a marketing strategy." />;
  const list = (await listBusinesses(user, active.id)).map((b) => ({ id: b.id, name: b.name }));
  return <NewStrategyForm workspaceId={active.id} businesses={list} defaultBusinessId={list.some((b) => b.id === business) ? business : undefined} />;
}
