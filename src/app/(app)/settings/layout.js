import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { getSettingsLinks } from "@/server/workspaces/settings.js";

export default function SettingsLayout({ children }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Settings" description="Your account, your workspace, your team and your plan." />
      <Suspense fallback={<div className="h-10 border-b" />}><Nav /></Suspense>
      {children}
    </div>
  );
}

async function Nav() {
  const user = await requireUserOrRedirect("/settings");
  const { active } = await getActiveWorkspace(user.id);
  return <SettingsNav links={await getSettingsLinks(user, active?.id)} />;
}
