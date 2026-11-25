"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AlertCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { switchWorkspaceAction } from "@/server/actions/workspace-actions.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const STATE = { expired: "This invitation has expired. Ask for a new one.", revoked: "This invitation was cancelled.", accepted: "This invitation has already been used." };

export function InvitationCard({ token, invite, user }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const back = `/invite/${token}`;
  if (!invite) return <Alert variant="destructive"><AlertCircle /><AlertDescription>This invitation link isn&apos;t valid.</AlertDescription></Alert>;

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiRequest("/api/v1/invitations/accept", { method: "POST", body: { token } });
      await switchWorkspaceAction(r.workspaceId);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-[15px]"><span className="font-semibold">{invite.invitedBy}</span> invited <span className="font-semibold">{invite.email}</span> to join <span className="font-semibold">{invite.workspace}</span> as {invite.roleLabel}.</p>
      {invite.state !== "pending" ? <Alert variant="destructive"><AlertCircle /><AlertDescription>{STATE[invite.state]}</AlertDescription></Alert> : (
        <>
          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
          {user ? (
            user.email.toLowerCase() === invite.email.toLowerCase() ? (
              <Button size="lg" disabled={busy} onClick={accept}>{busy && <Loader2 className="animate-spin" />} Join {invite.workspace}</Button>
            ) : (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">You&apos;re signed in as {user.email}. Sign in with {invite.email} to accept.</p>
                <Button variant="outline" onClick={() => signOut({ callbackUrl: `/login?callbackUrl=${encodeURIComponent(back)}` })}>Switch account</Button>
              </div>
            )
          ) : (
            <div className="grid gap-2">
              <Button size="lg" asChild><Link href={`/login?callbackUrl=${encodeURIComponent(back)}`}>Sign in to accept</Link></Button>
              <Button variant="outline" asChild><Link href={`/register?callbackUrl=${encodeURIComponent(back)}`}>Create an account with {invite.email}</Link></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
