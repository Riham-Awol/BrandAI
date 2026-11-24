import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAutomationSettings } from "@/modules/automation/settings-service.js";
import { listIntegrations } from "@/modules/automation/integrations-service.js";
import { listRules } from "@/modules/automation/rules-service.js";
import { listReminders } from "@/modules/automation/reminders-service.js";
import { RulesPanel } from "@/modules/automation/components/rules-panel";

export const metadata = { title: "Rules & reminders" };

export default function RulesPage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Rules /></Suspense>;
}

async function Rules() {
  const user = await requireUserOrRedirect("/automation/rules");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const [settings, integrations, rules, reminders] = await Promise.all([getAutomationSettings(user, active.id), listIntegrations(user, active.id), listRules(user, active.id), listReminders(user, active.id)]);
  return <RulesPanel workspaceId={active.id} initialRules={JSON.parse(JSON.stringify(rules))} initialReminders={JSON.parse(JSON.stringify(reminders))} integrations={integrations} canManage={settings.permissions.canManage} mode={settings.mode} />;
}
