import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { getAutomationSettings } from "@/modules/automation/settings-service.js";
import { listIntegrations } from "@/modules/automation/integrations-service.js";
import { CalendarView } from "@/modules/automation/components/calendar-view";

export const metadata = { title: "Marketing calendar" };

export default function AutomationPage() {
  return <Suspense fallback={<Skeleton className="h-[560px] w-full" />}><Calendar /></Suspense>;
}

async function Calendar() {
  const user = await requireUserOrRedirect("/automation");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const [businesses, settings, integrations] = await Promise.all([listBusinesses(user, active.id), getAutomationSettings(user, active.id), listIntegrations(user, active.id)]);
  return <CalendarView workspaceId={active.id} businesses={businesses.map((b) => ({ id: b.id, name: b.name }))} integrations={integrations} mode={settings.mode} canSchedule={settings.permissions.canSchedule} />;
}
