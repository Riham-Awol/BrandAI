import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getCampaign } from "@/modules/automation/campaigns-service.js";
import { getAutomationSettings } from "@/modules/automation/settings-service.js";
import { CampaignEditor } from "@/modules/automation/components/campaign-editor";

export const metadata = { title: "Email campaign" };

export default function CampaignPage({ params }) {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Editor params={params} /></Suspense>;
}

async function Editor({ params }) {
  const { campaignId } = await params;
  const user = await requireUserOrRedirect(`/automation/campaigns/${campaignId}`);
  const { active } = await getActiveWorkspace(user.id);
  const campaign = await loadOr404(() => getCampaign(user, active?.id, campaignId));
  const settings = await getAutomationSettings(user, active.id);
  return <CampaignEditor workspaceId={active.id} initialCampaign={JSON.parse(JSON.stringify(campaign))} mode={settings.mode} />;
}
