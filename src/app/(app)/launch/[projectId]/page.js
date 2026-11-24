import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAiStatus } from "@/server/ai/status.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getLaunchProject } from "@/modules/launch/service.js";
import { LaunchStudio } from "@/modules/launch/components/launch-studio";

export const metadata = { title: "Launch plan" };

export default function LaunchProjectPage({ params }) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <Studio params={params} />
    </Suspense>
  );
}

async function Studio({ params }) {
  const { projectId } = await params;
  const user = await requireUserOrRedirect(`/launch/${projectId}`);
  const { active } = await getActiveWorkspace(user.id);
  const project = await loadOr404(() => getLaunchProject(user, active?.id, projectId));
  return <LaunchStudio workspaceId={active.id} initialProject={project} ai={getAiStatus()} />;
}

function StudioSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-2 w-full" />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]"><Skeleton className="h-80" /><Skeleton className="h-96" /></div>
    </div>
  );
}
