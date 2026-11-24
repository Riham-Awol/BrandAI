import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAiStatus } from "@/server/ai/status.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getDocument } from "@/modules/stationery/documents-service.js";
import { DocumentEditor } from "@/modules/stationery/components/document-editor";

export const metadata = { title: "Document" };

export default function DocumentPage({ params }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }) {
  const { documentId } = await params;
  const user = await requireUserOrRedirect(`/stationery/documents/${documentId}`);
  const { active } = await getActiveWorkspace(user.id);
  const doc = await loadOr404(() => getDocument(user, active?.id, documentId));
  return <DocumentEditor key={`${doc.id}-${doc.updatedAt}`} workspaceId={active.id} initialDocument={doc} ai={getAiStatus()} />;
}
