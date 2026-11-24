import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { NewSocialForm } from "@/modules/social/components/new-social-form";

export const metadata = { title: "New social plan" };

export default function NewSocialPage({ searchParams }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Social Media Studio" title="Plan a month of posts" description="Your profile, brand voice and marketing plan are reused automatically." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }) {
  const { business } = await searchParams;
  const user = await requireUserOrRedirect("/social/new");
  const { active } = await getActiveWorkspace(user.id);
  if (!active || active.role === "VIEWER") return <EmptyState icon={Lock} title="View-only access" description="You need editor access in this workspace to plan social content." />;
  const list = (await listBusinesses(user, active.id)).map((b) => ({ id: b.id, name: b.name }));
  return <NewSocialForm workspaceId={active.id} businesses={list} defaultBusinessId={list.some((b) => b.id === business) ? business : undefined} />;
}
