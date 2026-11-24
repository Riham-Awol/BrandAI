import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listBusinesses } from "@/server/businesses/service.js";
import { getAiStatus } from "@/server/ai/status.js";
import { listCampaigns } from "@/modules/automation/campaigns-service.js";
import { NewCampaignForm } from "@/modules/automation/components/campaign-editor";

export const metadata = { title: "Email campaigns" };

export default function CampaignsPage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Campaigns /></Suspense>;
}

async function Campaigns() {
  const user = await requireUserOrRedirect("/automation/campaigns");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const [campaigns, businesses] = await Promise.all([listCampaigns(user, active.id), listBusinesses(user, active.id)]);
  return (
    <div className="space-y-6">
      {active.role !== "VIEWER" && <NewCampaignForm workspaceId={active.id} businesses={businesses.map((b) => ({ id: b.id, name: b.name }))} ai={getAiStatus()} />}
      {campaigns.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground"><Mail className="mx-auto mb-2 size-6" />No campaigns yet.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Card className="relative gap-1">
                <div className="flex items-start justify-between gap-2"><p className="font-semibold"><Link className="after:absolute after:inset-0" href={`/automation/campaigns/${c.id}`}>{c.name}</Link></p><Badge variant={c.status === "SENT" ? "success" : "secondary"}>{c.status.toLowerCase()}</Badge></div>
                <p className="truncate text-sm text-muted-foreground">{c.subject}</p>
                <p className="text-xs text-muted-foreground">{c.business.name}{c.status === "SENT" ? ` · sent to ${c.sentCount}` : ""}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
