"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { humanize } from "@/lib/humanize";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/layout/error-state";
import { FONT_BY_KEY } from "../catalog/fonts.js";
import { PaletteSwatches } from "./brand-views";

/** Final step: review the assembled identity and approve it for reuse. */
export function IdentityReview({ base, project, logoSrc }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState({ busy: false, message: null, error: null });

  useEffect(() => {
    apiRequest(`${base}/identity`).then(setData).catch((e) => setError(e.message));
  }, [base]);

  if (error) return <ErrorState description={error} />;
  if (!data) return <Skeleton className="h-96 w-full" />;
  const { draft, approved } = data;
  const d = draft.data;

  async function approve() {
    setStatus({ busy: true, message: null, error: null });
    try {
      const result = await apiRequest(`${base}/identity`, { method: "POST" });
      setData(await apiRequest(`${base}/identity`));
      setStatus({ busy: false, message: `Brand identity version ${result.version} approved. Every Brand AI studio will now use it.`, error: null });
    } catch (e) {
      setStatus({ busy: false, message: null, error: e.message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold">Review & approve</h2>
        <p className="text-sm text-muted-foreground">This is the identity assembled from your accepted (or latest) results and your selections.</p>
      </div>
      {approved && (
        <Alert variant="success">
          <ShieldCheck />
          <AlertTitle>Approved identity: version {approved.version}</AlertTitle>
          <AlertDescription>
            Approved {new Date(approved.approvedAt).toLocaleString()}. <Link className="font-semibold underline" href={`/businesses/${project.business.id}/brand`}>Open brand hub</Link>
          </AlertDescription>
        </Alert>
      )}
      {!draft.complete && (
        <Alert variant="info"><AlertCircle /><AlertDescription>Generate these sections before approving: {draft.missing.join(", ")}.</AlertDescription></Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Logo</CardTitle><CardDescription>{d.logo ? `${d.logo.name} — ${humanize(d.logo.markType)}` : "Not generated yet"}</CardDescription></CardHeader>
          {d.logo && logoSrc && (
            <div className="relative grid place-items-center h-40 rounded-xl border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Selected logo" className="absolute inset-0 h-full w-full object-contain p-3" />
            </div>
          )}
        </Card>
        <Card>
          <CardHeader><CardTitle>Tagline</CardTitle></CardHeader>
          <p className="font-display text-xl">{d.tagline ? `“${d.tagline}”` : <span className="text-sm text-muted-foreground">Optional — not selected</span>}</p>
        </Card>
        <Card>
          <CardHeader><CardTitle>Typography</CardTitle></CardHeader>
          {d.typography ? (
            <p className="text-sm">Headings: <strong>{FONT_BY_KEY[d.typography.heading.fontKey]?.family} {d.typography.heading.weight}</strong><br />Body: <strong>{FONT_BY_KEY[d.typography.body.fontKey]?.family} {d.typography.body.weight}</strong></p>
          ) : <p className="text-sm text-muted-foreground">Not generated yet</p>}
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Colours</CardTitle><CardDescription>{d.palette?.name}</CardDescription></CardHeader>
          {d.palette ? <PaletteSwatches colors={d.palette.colors} size="lg" /> : <p className="text-sm text-muted-foreground">Not generated yet</p>}
        </Card>
        <Card>
          <CardHeader><CardTitle>Personality</CardTitle></CardHeader>
          {d.personality ? (
            <div className="space-y-2 text-sm">
              <Badge className="capitalize">{d.personality.archetype}</Badge>
              <p>{d.personality.summary}</p>
            </div>
          ) : <p className="text-sm text-muted-foreground">Not generated yet</p>}
        </Card>
        <Card>
          <CardHeader><CardTitle>Voice</CardTitle></CardHeader>
          {d.voice ? <p className="text-sm">{d.voice.summary}</p> : <p className="text-sm text-muted-foreground">Not generated yet</p>}
        </Card>
      </div>

      {status.error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{status.error}</AlertDescription></Alert>}
      {status.message && <Alert variant="success"><CheckCircle2 /><AlertDescription>{status.message}</AlertDescription></Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        {project.permissions.canApprove ? (
          <Button size="lg" onClick={approve} disabled={!draft.complete || status.busy}>
            <ShieldCheck /> {approved ? "Approve as new version" : "Approve brand identity"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">A workspace admin or owner needs to approve the brand identity.</p>
        )}
      </div>
    </div>
  );
}
