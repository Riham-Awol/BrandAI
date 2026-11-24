import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { getAutomationSettings } from "@/modules/automation/settings-service.js";
import { listIntegrations } from "@/modules/automation/integrations-service.js";
import { listItems } from "@/modules/automation/queue-service.js";
import { QueueBoard } from "@/modules/automation/components/queue-board";

export const metadata = { title: "Queue & approvals" };

export default function QueuePage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Queue /></Suspense>;
}

async function Queue() {
  const user = await requireUserOrRedirect("/automation/queue");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const [items, businesses, settings, integrations] = await Promise.all([listItems(user, active.id), listBusinesses(user, active.id), getAutomationSettings(user, active.id), listIntegrations(user, active.id)]);
  return <QueueBoard workspaceId={active.id} initialItems={JSON.parse(JSON.stringify(items))} businesses={businesses.map((b) => ({ id: b.id, name: b.name }))} integrations={integrations} settings={settings} />;
}
