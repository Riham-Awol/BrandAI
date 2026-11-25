import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { guardAdminPage } from "@/server/platform/page-guard.js";
import { AdminMfaNotice } from "@/components/admin/mfa-notice";
import { listWorkspaces } from "@/server/platform/admin-service.js";
import { AdminWorkspaces } from "@/components/admin/admin-workspaces";

export const metadata = { title: "Workspaces" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><View /></Suspense>;
}

async function View() {
  const { user, needsMfa } = await guardAdminPage("/admin/workspaces");
  if (needsMfa) return <AdminMfaNotice />;
  return <AdminWorkspaces initial={JSON.parse(JSON.stringify(await listWorkspaces(user)))} />;
}
