import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Palette, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getBusinessProfile } from "@/server/businesses/profile-service.js";
import { BusinessProfileView } from "@/components/business/business-profile-view";

export const metadata = { title: "Business profile" };

export default function BusinessPage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-72" /><Skeleton className="h-96 w-full" /></div>}>
      <Business params={params} />
    </Suspense>
  );
}

async function Business({ params }) {
  const { businessId } = await params;
  const user = await requireUserOrRedirect(`/businesses/${businessId}`);
  const { active } = await getActiveWorkspace(user.id);
  const data = await loadOr404(() => getBusinessProfile(user, active?.id, businessId));
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Business profile"
        title={data.profile.name}
        description="The single source of truth Brand AI uses for every studio."
        actions={
          <>
            <Button variant="outline" asChild><Link href={`/businesses/${businessId}/brand`}><Palette /> Brand hub</Link></Button>
            <Button variant="outline" asChild><Link href={`/businesses/${businessId}/marketing`}><Target /> Marketing plan</Link></Button>
          </>
        }
      />
      <BusinessProfileView workspaceId={active.id} businessId={businessId} initial={data} />
    </div>
  );
}
