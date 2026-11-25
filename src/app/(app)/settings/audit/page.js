import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { listAuditLog } from "@/server/workspaces/team-service.js";
import { AuditLog } from "@/components/settings/audit-log";

export const metadata = { title: "Audit log" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full max-w-4xl" />}><View /></Suspense>;
}

async function View() {
  const user = await requireUserOrRedirect("/settings/audit");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const data = await loadOr404(() => listAuditLog(user, active.id, {}));
  return <AuditLog workspaceId={active.id} initial={JSON.parse(JSON.stringify(data))} />;
}
