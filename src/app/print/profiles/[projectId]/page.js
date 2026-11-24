import { Suspense } from "react";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getPrintableProfile } from "@/modules/stationery/profile-service.js";
import { ProfileBrochure } from "@/modules/stationery/components/profile-brochure";
import { PrintToolbar } from "@/components/print/print-toolbar";

/** Standalone, print-ready company profile (A4 pages; "Save as PDF" in the print dialog). */
export default function PrintProfilePage({ params }) {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Loading…</p>}>
      <Printable params={params} />
    </Suspense>
  );
}

async function Printable({ params }) {
  const { projectId } = await params;
  const user = await requireUserOrRedirect(`/print/profiles/${projectId}`);
  const { active } = await getActiveWorkspace(user.id);
  const data = await loadOr404(() => getPrintableProfile(user, active?.id, projectId));
  return (
    <div className="min-h-dvh bg-[#ecebef] py-6 print:bg-white print:py-0">
      <title>{data.project.name}</title>
      <PrintToolbar backHref={`/stationery/profiles/${projectId}?section=brochure`} margin="0" />
      <div className="mx-auto max-w-[210mm] px-4 print:max-w-none print:px-0">
        {data.isMock && <p className="mb-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 print:hidden">Contains mock (test) content.</p>}
        <ProfileBrochure content={data.content} brand={data.brand} details={data.details} />
      </div>
    </div>
  );
}
