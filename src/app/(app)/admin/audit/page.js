import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { guardAdminPage } from "@/server/platform/page-guard.js";
import { AdminMfaNotice } from "@/components/admin/mfa-notice";
import { listPlatformAudit } from "@/server/platform/admin-service.js";
import { AdminAudit } from "@/components/admin/admin-audit";

export const metadata = { title: "Platform audit log" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><View /></Suspense>;
}

async function View() {
  const { user, needsMfa } = await guardAdminPage("/admin/audit");
  if (needsMfa) return <AdminMfaNotice />;
  return <AdminAudit initial={JSON.parse(JSON.stringify(await listPlatformAudit(user, {})))} />;
}
