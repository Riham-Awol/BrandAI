import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAiStatus } from "@/server/ai/status.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getWebsite } from "@/modules/website/service.js";
import { WebsiteEditor } from "@/modules/website/components/website-editor";

export const metadata = { title: "Website" };

export default function WebsiteEditorPage({ params }) {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-12 w-80" /><div className="grid gap-6 lg:grid-cols-[360px_1fr]"><Skeleton className="h-[600px]" /><Skeleton className="h-[600px]" /></div></div>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }) {
  const { websiteId } = await params;
  const user = await requireUserOrRedirect(`/websites/${websiteId}`);
  const { active } = await getActiveWorkspace(user.id);
  const website = await loadOr404(() => getWebsite(user, active?.id, websiteId));
  return <WebsiteEditor key={website.id} workspaceId={active.id} initialWebsite={website} ai={getAiStatus()} />;
}
