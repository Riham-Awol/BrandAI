import { Suspense } from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { NewProfileForm } from "@/modules/stationery/components/new-profile-form";

export const metadata = { title: "New company profile" };

export default function NewProfilePage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Stationery & Merchandise" title="Create a company profile" description="A branded brochure about your business, written from your approved profile and brand voice." />
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-2xl" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const user = await requireUserOrRedirect("/stationery/profiles/new");
  const { active } = await getActiveWorkspace(user.id);
  if (!active || active.role === "VIEWER") return <EmptyState icon={Lock} title="View-only access" description="You need editor access in this workspace to create a company profile." />;
  const list = (await listBusinesses(user, active.id)).map((b) => ({ id: b.id, name: b.name }));
  return <NewProfileForm workspaceId={active.id} businesses={list} />;
}
