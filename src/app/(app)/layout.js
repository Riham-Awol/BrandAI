import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";

/**
 * Authenticated area. The session read happens inside a Suspense boundary
 * (required with Cache Components) and is re-validated against the database.
 */
export default function AppLayout({ children }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }) {
  const user = await requireUserOrRedirect();
  const { active, workspaces } = await getActiveWorkspace(user.id);
  return (
    <AppShell user={user} workspaces={workspaces} activeWorkspace={active}>
      {children}
    </AppShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      <div className="hidden border-r bg-sidebar p-4 lg:block"><Skeleton className="h-8 w-32" /><Skeleton className="mt-6 h-14 w-full" /></div>
      <div className="p-10"><Skeleton className="h-10 w-72" /><Skeleton className="mt-8 h-48 w-full" /></div>
    </div>
  );
}
