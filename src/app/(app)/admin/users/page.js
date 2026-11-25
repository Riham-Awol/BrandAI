import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { guardAdminPage } from "@/server/platform/page-guard.js";
import { AdminMfaNotice } from "@/components/admin/mfa-notice";
import { listUsers } from "@/server/platform/admin-service.js";
import { AdminUsers } from "@/components/admin/admin-users";

export const metadata = { title: "Users" };

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><View /></Suspense>;
}

async function View() {
  const { user, needsMfa } = await guardAdminPage("/admin/users");
  if (needsMfa) return <AdminMfaNotice />;
  return <AdminUsers initial={JSON.parse(JSON.stringify(await listUsers(user)))} />;
}
