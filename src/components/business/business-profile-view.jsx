"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { ProfileEditor } from "./profile-editor";
import { ContextApproval } from "./context-approval";

export function BusinessProfileView({ workspaceId, businessId, initial }) {
  const [context, setContext] = useState(initial.context);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <ProfileEditor
        workspaceId={workspaceId}
        businessId={businessId}
        initialProfile={initial.profile}
        canEdit={initial.permissions.canEdit}
        onSaved={async () => setContext((await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses/${businessId}/profile`)).context)}
      />
      <div className="xl:sticky xl:top-24 xl:self-start">
        <ContextApproval key={context?.draft?.id ?? "none"} workspaceId={workspaceId} businessId={businessId} context={context} canApprove={initial.permissions.canApprove} onApproved={async () => setContext((await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses/${businessId}/profile`)).context)} />
      </div>
    </div>
  );
}
