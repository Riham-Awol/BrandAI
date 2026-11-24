import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { getCurrentIdentity } from "@/modules/brand/identity-service.js";
import { listBrandAssets } from "@/modules/brand/assets-service.js";
import { BrandHub } from "@/modules/brand/components/brand-hub";

export const metadata = { title: "Brand hub" };

export default function BrandHubPage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-72" /><Skeleton className="h-96 w-full" /></div>}>
      <Hub params={params} />
    </Suspense>
  );
}

async function Hub({ params }) {
  const { businessId } = await params;
  const user = await requireUserOrRedirect(`/businesses/${businessId}/brand`);
  const { active } = await getActiveWorkspace(user.id);
  const { business, identity } = await loadOr404(() => getCurrentIdentity(user, active?.id, businessId));
  const [assets, scope] = await Promise.all([listBrandAssets(user, active.id, businessId), requireWorkspaceAccess(user, active.id)]);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Brand hub" title={business.name} description="Your approved brand identity, logo files and brand assets in one place." />
      <BrandHub
        workspaceId={active.id}
        business={{ id: business.id, name: business.name }}
        identity={identity}
        initialAssets={assets}
        permissions={{ canUpload: scope.can(PERMISSIONS.FILES_UPLOAD), canDelete: scope.can(PERMISSIONS.FILES_DELETE) }}
      />
    </div>
  );
}
