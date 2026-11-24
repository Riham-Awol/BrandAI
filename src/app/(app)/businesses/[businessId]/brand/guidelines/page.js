import Link from "next/link";
import { Suspense } from "react";
import { Palette } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getCurrentIdentity } from "@/modules/brand/identity-service.js";
import { GuidelinesView } from "@/modules/brand/components/guidelines-view";

export const metadata = { title: "Brand guidelines" };

export default function GuidelinesPage({ params }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[600px] max-w-4xl" />}>
      <Guidelines params={params} />
    </Suspense>
  );
}

async function Guidelines({ params }) {
  const { businessId } = await params;
  const user = await requireUserOrRedirect(`/businesses/${businessId}/brand/guidelines`);
  const { active } = await getActiveWorkspace(user.id);
  const { identity } = await loadOr404(() => getCurrentIdentity(user, active?.id, businessId));
  if (!identity) {
    return (
      <EmptyState
        icon={Palette}
        title="No approved brand identity"
        description="Approve a brand identity first; guidelines are generated from it."
        action={<Button asChild><Link href="/brand">Brand Identity Studio</Link></Button>}
      />
    );
  }
  return <GuidelinesView identity={identity} logoBase={`/api/v1/workspaces/${active.id}/businesses/${businessId}/brand/logo`} />;
}
