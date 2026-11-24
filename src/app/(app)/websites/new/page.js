import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { getAiStatus } from "@/server/ai/status.js";
import { NewWebsiteForm } from "@/modules/website/components/new-website-form";

export const metadata = { title: "New website" };

export default function NewWebsitePage({ searchParams }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Website Builder" title="Create a website" description="Your business profile, brand and voice are reused automatically. You can edit everything before publishing." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }) {
  const { business } = await searchParams;
  const user = await requireUserOrRedirect("/websites/new");
  const { active } = await getActiveWorkspace(user.id);
  if (!active || active.role === "VIEWER") return <EmptyState icon={Lock} title="View-only access" description="You need editor access in this workspace to create websites." />;
  const list = (await listBusinesses(user, active.id)).map((b) => ({ id: b.id, name: b.name }));
  return <NewWebsiteForm workspaceId={active.id} businesses={list} ai={getAiStatus()} defaultBusinessId={list.some((b) => b.id === business) ? business : undefined} />;
}
