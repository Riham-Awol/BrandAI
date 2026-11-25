import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getWorkspaceSettings } from "@/server/workspaces/team-service.js";
import { WorkspaceSettings } from "@/components/settings/workspace-settings";

export const metadata = { title: "Workspace settings" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full max-w-4xl" />}><View /></Suspense>;
}

async function View() {
  const user = await requireUserOrRedirect("/settings/workspace");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  return <WorkspaceSettings initial={JSON.parse(JSON.stringify(await loadOr404(() => getWorkspaceSettings(user, active.id))))} />;
}
