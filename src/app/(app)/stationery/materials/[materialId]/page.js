import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getMaterial } from "@/modules/stationery/materials-service.js";
import { MaterialEditor } from "@/modules/stationery/components/material-editor";

export const metadata = { title: "Branded item" };

export default function MaterialPage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-80" /><div className="grid gap-6 lg:grid-cols-[1fr_400px]"><Skeleton className="aspect-[4/3]" /><Skeleton className="h-96" /></div></div>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }) {
  const { materialId } = await params;
  const user = await requireUserOrRedirect(`/stationery/materials/${materialId}`);
  const { active } = await getActiveWorkspace(user.id);
  const material = await loadOr404(() => getMaterial(user, active?.id, materialId));
  return <MaterialEditor key={material.id} workspaceId={active.id} initialMaterial={material} />;
}
