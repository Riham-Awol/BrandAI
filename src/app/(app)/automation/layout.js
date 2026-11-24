import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getAutomationSettings } from "@/modules/automation/settings-service.js";
import { MODES } from "@/modules/automation/catalog.js";
import { AutomationNav } from "@/modules/automation/components/automation-nav";

export default function AutomationLayout({ children }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Studio"
        title="Calendar & Automation"
        description="Plan, approve and publish your marketing — automation only ever acts as your settings allow."
        actions={<Suspense fallback={null}><ModeBadge /></Suspense>}
      />
      <AutomationNav />
      {children}
    </div>
  );
}

async function ModeBadge() {
  const user = await requireUserOrRedirect("/automation");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const s = await getAutomationSettings(user, active.id);
  return (
    <Link href="/automation/settings" className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-accent">
      Mode: <Badge variant={s.mode === "AUTOMATED" ? "warning" : "secondary"}>{MODES[s.mode].label}</Badge>
    </Link>
  );
}
