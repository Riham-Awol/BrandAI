"use client";

import { useState } from "react";
import { AlertCircle, Check, ExternalLink, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [["reach", "Reach"], ["impressions", "Impressions"], ["likes", "Likes"], ["comments", "Comments"], ["shares", "Shares"], ["saves", "Saves"], ["clicks", "Link clicks"]];
const blank = (m) => Object.fromEntries(FIELDS.map(([k]) => [k, m?.[k] ?? ""]));

/** Enter results for published posts, copied from each platform's own insights. */
export function PostResults({ workspaceId, posts, canEdit, days }) {
  const [values, setValues] = useState(() => Object.fromEntries(posts.map((p) => [p.id, blank(p.metrics)])));
  const [savedAt, setSavedAt] = useState(() => Object.fromEntries(posts.map((p) => [p.id, p.metrics?.updatedAt ?? null])));
  const [busy, setBusy] = useState(null);
  const [errors, setErrors] = useState({});

  async function save(id) {
    setBusy(id);
    setErrors((e) => ({ ...e, [id]: null }));
    try {
      const body = Object.fromEntries(FIELDS.map(([k]) => [k, values[id][k] === "" ? null : values[id][k]]));
      const r = await apiRequest(`/api/v1/workspaces/${workspaceId}/analytics/posts/${id}/metrics`, { method: "PUT", body });
      setSavedAt((s) => ({ ...s, [id]: r.updatedAt }));
    } catch (e) {
      setErrors((x) => ({ ...x, [id]: e.details?.reach?.[0] ?? e.message }));
    } finally {
      setBusy(null);
    }
  }

  if (!posts.length) {
    return <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No posts were published in the last {days} days. Published posts from Calendar &amp; Automation appear here.</p>;
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Copy the numbers from each platform&apos;s insights (for example Facebook Insights or Instagram&apos;s “View insights”). Leave a box empty if the platform doesn&apos;t show it.</p>
      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id}>
            <Card className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{new Date(p.publishedAt).toLocaleString()} · {p.business} · {p.channel}</p>
                </div>
                {p.externalUrl && <a href={p.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-2">Open post <ExternalLink className="size-3.5" /></a>}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {FIELDS.map(([k, label]) => (
                  <div key={k} className="grid gap-1">
                    <Label htmlFor={`${p.id}-${k}`} className="text-xs">{label}</Label>
                    <Input id={`${p.id}-${k}`} inputMode="numeric" pattern="[0-9]*" disabled={!canEdit} value={values[p.id][k]} onChange={(e) => setValues((v) => ({ ...v, [p.id]: { ...v[p.id], [k]: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) } }))} />
                  </div>
                ))}
              </div>
              {errors[p.id] && <Alert variant="destructive"><AlertCircle /><AlertDescription>{errors[p.id]}</AlertDescription></Alert>}
              <div className="flex flex-wrap items-center gap-3">
                {canEdit && <Button size="sm" disabled={busy !== null} onClick={() => save(p.id)}>{busy === p.id ? <Loader2 className="animate-spin" /> : <Check />} Save results</Button>}
                {savedAt[p.id] && <p className="text-xs text-muted-foreground" role="status">Saved {new Date(savedAt[p.id]).toLocaleString()}</p>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
