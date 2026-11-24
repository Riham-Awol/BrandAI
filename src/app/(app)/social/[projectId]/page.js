import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAiStatus } from "@/server/ai/status.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { socialEngine } from "@/modules/social/service.js";
import { SocialStudio } from "@/modules/social/components/social-studio";

export const metadata = { title: "Social plan" };

export default function SocialProjectPage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-80" /><Skeleton className="h-96 w-full" /></div>}>
      <Studio params={params} />
    </Suspense>
  );
}

async function Studio({ params }) {
  const { projectId } = await params;
  const user = await requireUserOrRedirect(`/social/${projectId}`);
  const { active } = await getActiveWorkspace(user.id);
  const project = await loadOr404(() => socialEngine.getProject(user, active?.id, projectId));
  return <SocialStudio workspaceId={active.id} initialProject={project} ai={getAiStatus()} />;
}
