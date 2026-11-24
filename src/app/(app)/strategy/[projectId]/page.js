import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAiStatus } from "@/server/ai/status.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { strategyEngine } from "@/modules/strategy/service.js";
import { StrategyStudio } from "@/modules/strategy/components/strategy-studio";

export const metadata = { title: "Marketing strategy" };

export default function StrategyProjectPage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-80" /><Skeleton className="h-96 w-full" /></div>}>
      <Studio params={params} />
    </Suspense>
  );
}

async function Studio({ params }) {
  const { projectId } = await params;
  const user = await requireUserOrRedirect(`/strategy/${projectId}`);
  const { active } = await getActiveWorkspace(user.id);
  const project = await loadOr404(() => strategyEngine.getProject(user, active?.id, projectId));
  return <StrategyStudio workspaceId={active.id} initialProject={project} ai={getAiStatus()} />;
}
