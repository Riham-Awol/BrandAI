import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { EmptyState } from "@/components/layout/empty-state";
import { Lock } from "lucide-react";
import { listBusinesses } from "@/server/businesses/service.js";
import { AudienceManager } from "@/modules/automation/components/audience-manager";

export const metadata = { title: "Email audience" };

export default function AudiencePage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Audience /></Suspense>;
}

async function Audience() {
  const user = await requireUserOrRedirect("/automation/audience");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  if (active.role === "VIEWER") return <EmptyState icon={Lock} title="Editors only" description="Contact lists contain personal data and are visible to editors, admins and owners." />;
  const businesses = await listBusinesses(user, active.id);
  return <AudienceManager workspaceId={active.id} businesses={businesses.map((b) => ({ id: b.id, name: b.name }))} />;
}
