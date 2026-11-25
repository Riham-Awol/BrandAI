import { Suspense } from "react";
import { connection } from "next/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/server/auth/session.js";
import { getInvitation } from "@/server/workspaces/team-service.js";
import { InvitationCard } from "@/components/auth/invitation-card";

export const metadata = { title: "Workspace invitation", robots: { index: false } };

export default function InvitePage({ params }) {
  return (
    <>
      <AuthHeading title="You're invited" description="Join your team on Brand AI." />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}><Invite params={params} /></Suspense>
    </>
  );
}

async function Invite({ params }) {
  const { token } = await params;
  await connection(); // invitation state depends on the current time
  const [user, invite] = await Promise.all([getCurrentUser(), getInvitation(token).catch(() => null)]);
  return <InvitationCard token={token} invite={invite} user={user ? { email: user.email, name: user.name } : null} />;
}
