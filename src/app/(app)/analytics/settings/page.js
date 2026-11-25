import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAnalyticsSettings } from "@/modules/analytics/service.js";
import { AnalyticsSettings } from "@/modules/analytics/components/analytics-settings";

export const metadata = { title: "Tracking & privacy" };

export default function AnalyticsSettingsPage() {
  return <Suspense fallback={<Skeleton className="h-72 w-full max-w-2xl" />}><SettingsView /></Suspense>;
}

async function SettingsView() {
  const user = await requireUserOrRedirect("/analytics/settings");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  return <AnalyticsSettings workspaceId={active.id} initial={await getAnalyticsSettings(user, active.id)} />;
}
