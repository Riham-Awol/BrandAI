import { Suspense } from "react";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { getAiStatus } from "@/server/ai/status.js";
import { DocumentEditor } from "@/modules/stationery/components/document-editor";

export const metadata = { title: "New document" };

export default function NewDocumentPage({ searchParams }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Editor searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ searchParams }) {
  const { type, business } = await searchParams;
  const user = await requireUserOrRedirect("/stationery/documents/new");
  const { active } = await getActiveWorkspace(user.id);
  if (!active || active.role === "VIEWER") return <EmptyState icon={Lock} title="View-only access" description="You need editor access in this workspace to create invoices and quotations." />;
  const list = (await listBusinesses(user, active.id)).map((b) => ({ id: b.id, name: b.name }));
  return <DocumentEditor workspaceId={active.id} type={type === "QUOTE" ? "QUOTE" : "INVOICE"} businesses={list} defaultBusinessId={list.some((b) => b.id === business) ? business : undefined} ai={getAiStatus()} />;
}
