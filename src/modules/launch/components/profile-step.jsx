"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/layout/error-state";
import { ProfileEditor } from "@/components/business/profile-editor";
import { ContextApproval } from "@/components/business/context-approval";

/** Final studio step: review the pre-filled profile, save it, approve it for reuse. */
export function ProfileStep({ workspaceId, projectBase, businessId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest(`${projectBase}/profile-draft`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setContext(d.context);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [projectBase]);

  if (error) return <ErrorState description={error} />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-72 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold">Business profile</h2>
        <p className="text-sm text-muted-foreground">We pre-filled this from your launch plan (accepted versions first). Adjust anything, save, then approve what Brand AI may reuse.</p>
      </div>
      <Alert variant="info">
        <Info />
        <AlertDescription>Saving replaces the profile lists with what you see here.</AlertDescription>
      </Alert>
      <ProfileEditor
        workspaceId={workspaceId}
        businessId={businessId}
        initialProfile={data.profile}
        canEdit={data.permissions.canEdit}
        submitLabel="Save business profile"
        onSaved={async () => setContext((await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses/${businessId}/profile`)).context)}
      />
      <ContextApproval key={context?.draft?.id ?? "none"} workspaceId={workspaceId} businessId={businessId} context={context} canApprove={data.permissions.canApprove} />
      {!data.permissions.canEdit && (
        <Alert><AlertCircle /><AlertDescription>You have view-only access.</AlertDescription></Alert>
      )}
      <div className="flex justify-end">
        <Button variant="outline" asChild><Link href={`/businesses/${businessId}`}>Open business profile</Link></Button>
      </div>
    </div>
  );
}
