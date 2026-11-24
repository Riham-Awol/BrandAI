import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { getAiStatus } from "@/server/ai/status.js";
import { getPostPrefill } from "@/modules/design/service.js";
import { NewDesignForm } from "@/modules/design/components/new-design-form";

export const metadata = { title: "New design" };

export default function NewDesignPage({ searchParams }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Creative Design Studio" title="Create a design" description="Describe it once. You get three on-brand options to choose from and edit." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }) {
  const { post, business } = await searchParams;
  const user = await requireUserOrRedirect("/design/new");
  const { active } = await getActiveWorkspace(user.id);
  if (!active || active.role === "VIEWER") return <EmptyState icon={Lock} title="View-only access" description="You need editor access in this workspace to create designs." />;
  const list = (await listBusinesses(user, active.id)).map((b) => ({ id: b.id, name: b.name }));
  let prefill = null;
  if (typeof post === "string") prefill = await getPostPrefill(user, active.id, post).catch(() => null);
  if (!prefill && list.some((b) => b.id === business)) prefill = { businessId: business };
  return <NewDesignForm workspaceId={active.id} businesses={list} ai={getAiStatus()} prefill={prefill} />;
}
