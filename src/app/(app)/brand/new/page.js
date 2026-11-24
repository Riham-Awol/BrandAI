import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { NewBrandForm } from "@/modules/brand/components/new-brand-form";

export const metadata = { title: "New brand identity" };

export default function NewBrandPage({ searchParams }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Brand Identity Studio" title="Shape your brand" description="Tell us the feeling you want. Everything else comes from your business profile." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }) {
  const { business } = await searchParams;
  const user = await requireUserOrRedirect("/brand/new");
  const { active } = await getActiveWorkspace(user.id);
  if (!active || active.role === "VIEWER") return <EmptyState icon={Lock} title="View-only access" description="You need editor access in this workspace to create a brand identity." />;
  const businesses = await listBusinesses(user, active.id);
  const list = businesses.map((b) => ({ id: b.id, name: b.name }));
  return <NewBrandForm workspaceId={active.id} businesses={list} defaultBusinessId={list.some((b) => b.id === business) ? business : undefined} />;
}
