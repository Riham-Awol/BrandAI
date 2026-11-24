import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getDesign, listDesignImages } from "@/modules/design/service.js";
import { DesignEditor } from "@/modules/design/components/design-editor";

export const metadata = { title: "Design" };

export default function DesignEditorPage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-80" /><div className="grid gap-6 lg:grid-cols-[1fr_400px]"><Skeleton className="aspect-square" /><Skeleton className="h-96" /></div></div>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }) {
  const { designId } = await params;
  const user = await requireUserOrRedirect(`/design/${designId}`);
  const { active } = await getActiveWorkspace(user.id);
  const design = await loadOr404(() => getDesign(user, active?.id, designId));
  const images = await listDesignImages(user, active.id, design.businessId);
  return <DesignEditor key={design.id} workspaceId={active.id} initialDesign={design} images={images} />;
}
