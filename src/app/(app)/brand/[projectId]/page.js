import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAiStatus } from "@/server/ai/status.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getBrandProject } from "@/modules/brand/service.js";
import { BrandStudio } from "@/modules/brand/components/brand-studio";

export const metadata = { title: "Brand identity" };

export default function BrandProjectPage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-80" /><Skeleton className="h-96 w-full" /></div>}>
      <Studio params={params} />
    </Suspense>
  );
}

async function Studio({ params }) {
  const { projectId } = await params;
  const user = await requireUserOrRedirect(`/brand/${projectId}`);
  const { active } = await getActiveWorkspace(user.id);
  const project = await loadOr404(() => getBrandProject(user, active?.id, projectId));
  return <BrandStudio workspaceId={active.id} initialProject={project} ai={getAiStatus()} />;
}
