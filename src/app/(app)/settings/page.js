import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getAccount } from "@/server/account/service.js";
import { AccountSettings } from "@/components/settings/account-settings";

export const metadata = { title: "Account & security" };

export default function AccountPage() {
  return <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl" />}><Account /></Suspense>;
}

async function Account() {
  const user = await requireUserOrRedirect("/settings");
  return <AccountSettings initial={JSON.parse(JSON.stringify(await getAccount(user)))} />;
}
