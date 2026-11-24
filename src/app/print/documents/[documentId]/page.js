import { Suspense } from "react";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getPrintableDocument } from "@/modules/stationery/documents-service.js";
import { DocumentSheet } from "@/modules/stationery/components/document-sheet";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { DOCUMENT_TYPES } from "@/modules/stationery/documents.js";

/** Standalone A4 view of an invoice/quotation for printing or "Save as PDF". */
export default function PrintDocumentPage({ params }) {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading…</p>}>
      <Printable params={params} />
    </Suspense>
  );
}

async function Printable({ params }) {
  const { documentId } = await params;
  const user = await requireUserOrRedirect(`/print/documents/${documentId}`);
  const { active } = await getActiveWorkspace(user.id);
  const data = await loadOr404(() => getPrintableDocument(user, active?.id, documentId));
  return (
    <div className="print-page min-h-dvh bg-[#ecebef] py-6 print:bg-white print:py-0">
      <title>{`${DOCUMENT_TYPES[data.document.type]} ${data.document.number}`}</title>
      <PrintToolbar backHref={`/stationery/documents/${documentId}`} />
      <div className="mx-auto max-w-[210mm] bg-white px-[16mm] py-[14mm] shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <DocumentSheet document={data.document} brand={data.brand} details={data.details} />
      </div>
    </div>
  );
}
