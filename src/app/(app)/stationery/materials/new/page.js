import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { getAiStatus } from "@/server/ai/status.js";
import { NewMaterialForm } from "@/modules/stationery/components/new-material-form";

export const metadata = { title: "New branded item" };

export default function NewMaterialPage({ searchParams }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Stationery & Merchandise" title="Create a branded item" description="Business cards, letterheads, T-shirts, uniforms, bags, mugs, labels and packaging — drawn with your approved logo, colours and fonts." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }) {
  const { kind, business } = await searchParams;
  const user = await requireUserOrRedirect("/stationery/materials/new");
  const { active } = await getActiveWorkspace(user.id);
  if (!active || active.role === "VIEWER") return <EmptyState icon={Lock} title="View-only access" description="You need editor access in this workspace to create branded items." />;
  const list = (await listBusinesses(user, active.id)).map((b) => ({ id: b.id, name: b.name }));
  return <NewMaterialForm workspaceId={active.id} businesses={list} ai={getAiStatus()} defaultKind={typeof kind === "string" ? kind : undefined} defaultBusinessId={list.some((b) => b.id === business) ? business : undefined} />;
}
