import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { guardAdminPage } from "@/server/platform/page-guard.js";
import { AdminMfaNotice } from "@/components/admin/mfa-notice";
import { getAiAdministration } from "@/server/platform/admin-service.js";
import { getPlatformSettings } from "@/server/platform/settings.js";
import { AdminAi } from "@/components/admin/admin-ai";

export const metadata = { title: "AI & services" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><View /></Suspense>;
}

async function View() {
  const { user, needsMfa } = await guardAdminPage("/admin/ai");
  if (needsMfa) return <AdminMfaNotice />;
  const [ai, settings] = await Promise.all([getAiAdministration(user), getPlatformSettings()]);
  return <AdminAi initial={JSON.parse(JSON.stringify(ai))} signupsOpen={settings.signupsOpen !== false} />;
}
