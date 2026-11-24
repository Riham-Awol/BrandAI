import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { getBusinessDetails } from "@/modules/stationery/details-service.js";
import { BusinessDetailsForm } from "@/modules/stationery/components/business-details-form";

export const metadata = { title: "Business details" };

export default function DetailsPage({ searchParams }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Stationery & Merchandise" title="Business details" description="Printed on business cards, letterheads, packaging, invoices and quotations exactly as you enter them." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Details searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Details({ searchParams }) {
  const { business } = await searchParams;
  const user = await requireUserOrRedirect("/stationery/details");
  const { active } = await getActiveWorkspace(user.id);
  const list = active ? (await listBusinesses(user, active.id)).map((b) => ({ id: b.id, name: b.name })) : [];
  if (!list.length) return <EmptyState icon={Building2} title="No business yet" description="Create a business first (for example in the Launch Studio)." />;
  const businessId = list.some((b) => b.id === business) ? business : list[0].id;
  const details = await getBusinessDetails(user, active.id, businessId);
  return <BusinessDetailsForm key={businessId} workspaceId={active.id} businesses={list} businessId={businessId} initial={details} canEdit={active.role !== "VIEWER"} />;
}
