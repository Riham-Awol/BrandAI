import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAutomationSettings } from "@/modules/automation/settings-service.js";
import { listIntegrations } from "@/modules/automation/integrations-service.js";
import { SettingsPanel } from "@/modules/automation/components/settings-panel";

export const metadata = { title: "Automation settings" };

export default function SettingsPage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Settings /></Suspense>;
}

async function Settings() {
  const user = await requireUserOrRedirect("/automation/settings");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const [settings, integrations] = await Promise.all([getAutomationSettings(user, active.id), listIntegrations(user, active.id)]);
  return <SettingsPanel workspaceId={active.id} initialSettings={settings} initialIntegrations={JSON.parse(JSON.stringify(integrations))} />;
}
