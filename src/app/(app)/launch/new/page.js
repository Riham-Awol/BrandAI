import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { IdeaForm } from "@/modules/launch/components/idea-form";
import { Lock } from "lucide-react";

export const metadata = { title: "New launch plan" };

export default function NewLaunchPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Business Launch Studio" title="Tell us about your idea" description="This takes about two minutes. You only need to describe it once." />
      <Suspense fallback={<Skeleton className="h-[480px] w-full" />}>
        <NewLaunchForm />
      </Suspense>
    </div>
  );
}

async function NewLaunchForm() {
  const user = await requireUserOrRedirect("/launch/new");
  const { active } = await getActiveWorkspace(user.id);
  if (!active || active.role === "VIEWER") {
    return <EmptyState icon={Lock} title="View-only access" description="You need editor access in this workspace to start a launch plan." />;
  }
  const businesses = await listBusinesses(user, active.id);
  return <IdeaForm workspaceId={active.id} businesses={businesses.map((b) => ({ id: b.id, name: b.name }))} />;
}
