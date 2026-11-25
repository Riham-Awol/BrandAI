import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAnalyticsPermissions, listReports } from "@/modules/analytics/service.js";
import { ReportsList } from "@/modules/analytics/components/reports-list";

export const metadata = { title: "Saved reports" };

export default function ReportsPage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Reports /></Suspense>;
}

async function Reports() {
  const user = await requireUserOrRedirect("/analytics/reports");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const [reports, perms] = await Promise.all([listReports(user, active.id), getAnalyticsPermissions(user, active.id)]);
  return <ReportsList workspaceId={active.id} initialReports={JSON.parse(JSON.stringify(reports))} canDelete={perms.canEdit} />;
}
