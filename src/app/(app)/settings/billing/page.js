import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getBilling } from "@/server/billing/service.js";
import { BillingSettings } from "@/components/settings/billing-settings";

export const metadata = { title: "Plan & usage" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full max-w-4xl" />}><View /></Suspense>;
}

async function View() {
  const user = await requireUserOrRedirect("/settings/billing");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const data = await loadOr404(() => getBilling(user, active.id));
  return <BillingSettings workspaceId={active.id} initial={JSON.parse(JSON.stringify(data))} />;
}
