import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { guardAdminPage } from "@/server/platform/page-guard.js";
import { AdminMfaNotice } from "@/components/admin/mfa-notice";
import { getPlatformOverview } from "@/server/platform/admin-service.js";
import { AdminOverview } from "@/components/admin/admin-overview";

export const metadata = { title: "Administration" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><View /></Suspense>;
}

async function View() {
  const { user, needsMfa } = await guardAdminPage("/admin");
  if (needsMfa) return <AdminMfaNotice />;
  return <AdminOverview data={JSON.parse(JSON.stringify(await getPlatformOverview(user)))} />;
}
