import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAiStatus } from "@/server/ai/status.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getPrintableProfile, profileEngine } from "@/modules/stationery/profile-service.js";
import { ProfileStudio } from "@/modules/stationery/components/profile-studio";

export const metadata = { title: "Company profile" };

export default function ProfilePage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-80" /><Skeleton className="h-96 w-full" /></div>}>
      <Studio params={params} />
    </Suspense>
  );
}

async function Studio({ params }) {
  const { projectId } = await params;
  const user = await requireUserOrRedirect(`/stationery/profiles/${projectId}`);
  const { active } = await getActiveWorkspace(user.id);
  const project = await loadOr404(() => profileEngine.getProject(user, active?.id, projectId));
  const printable = await getPrintableProfile(user, active.id, projectId);
  return <ProfileStudio workspaceId={active.id} initialProject={project} ai={getAiStatus()} brand={printable.brand} details={printable.details} />;
}
