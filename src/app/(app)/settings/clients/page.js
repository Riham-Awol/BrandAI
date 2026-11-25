import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { listClients } from "@/server/workspaces/agency-service.js";
import { ClientsSettings } from "@/components/settings/clients-settings";

export const metadata = { title: "Clients" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full max-w-4xl" />}><View /></Suspense>;
}

async function View() {
  const user = await requireUserOrRedirect("/settings/clients");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  if (active.type !== "AGENCY") return <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Client management is for agency workspaces. Create one in Settings → Workspace.</p>;
  const data = await loadOr404(() => listClients(user, active.id));
  return <ClientsSettings workspaceId={active.id} initial={JSON.parse(JSON.stringify(data))} />;
}
