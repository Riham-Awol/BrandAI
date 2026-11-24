"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { humanize } from "@/lib/humanize";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const SECTION_HELP = {
  basics: "Name, industry, description, stage, locations",
  offering: "Products and services",
  audience: "Target audiences and customer problems",
  goals: "Business goals",
  competitors: "Competitors",
};

/**
 * Lets admins/owners choose which profile sections Brand AI may reuse.
 * Only approved sections are ever sent to AI features.
 */
export function ContextApproval({ workspaceId, businessId, context, canApprove, onApproved }) {
  const draft = context?.draft;
  const approved = context?.approved;
  const available = draft ? Object.keys(draft.data ?? {}) : [];
  const [selected, setSelected] = useState(() => new Set(available));
  const [state, setState] = useState({ busy: false, error: null, done: false });

  async function approve() {
    setState({ busy: true, error: null, done: false });
    try {
      const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses/${businessId}/context/approve`, { method: "POST", body: { sections: [...selected] } });
      setState({ busy: false, error: null, done: true });
      onApproved?.(result);
    } catch (e) {
      setState({ busy: false, error: e.message, done: false });
    }
  }

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-highlight" /> Approved for AI reuse</CardTitle>
        <CardDescription>Brand AI only uses the sections you approve. You can change this whenever you update your profile.</CardDescription>
      </CardHeader>

      {approved ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Current: version {approved.version}</span>
          {(approved.approvedSections ?? []).map((s) => <Badge key={s} variant="success">{humanize(s)}</Badge>)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing approved yet.</p>
      )}

      {draft && !state.done && (
        <div className="space-y-4 rounded-xl border border-highlight/40 bg-accent/40 p-4">
          <p className="text-sm font-semibold">Changes waiting for approval (version {draft.version})</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {available.map((s) => (
              <li key={s}>
                <label className="flex items-start gap-2.5 rounded-lg bg-card p-3 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.has(s)}
                    disabled={!canApprove}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(s);
                      else next.delete(s);
                      setSelected(next);
                    }}
                  />
                  <span>
                    <span className="block font-medium">{humanize(s)}</span>
                    <span className="block text-xs text-muted-foreground">{SECTION_HELP[s] ?? ""}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {canApprove ? (
            <Button onClick={approve} disabled={state.busy || selected.size === 0}><CheckCircle2 /> Approve selected sections</Button>
          ) : (
            <p className="text-sm text-muted-foreground">A workspace admin or owner needs to approve these changes.</p>
          )}
        </div>
      )}
      {state.done && (
        <Alert variant="success"><CheckCircle2 /><AlertDescription>Approved. Brand AI will now use these sections across your studios.</AlertDescription></Alert>
      )}
      {state.error && (
        <Alert variant="destructive"><AlertCircle /><AlertDescription>{state.error}</AlertDescription></Alert>
      )}
    </Card>
  );
}
