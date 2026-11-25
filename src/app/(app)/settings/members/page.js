import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { listMembers } from "@/server/workspaces/team-service.js";
import { TeamSettings } from "@/components/settings/team-settings";

export const metadata = { title: "Team" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full max-w-4xl" />}><View /></Suspense>;
}

async function View() {
  const user = await requireUserOrRedirect("/settings/members");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const data = await loadOr404(() => listMembers(user, active.id));
  return <TeamSettings workspaceId={active.id} workspaceType={active.type} initial={JSON.parse(JSON.stringify(data))} />;
}
