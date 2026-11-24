"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Copy, History, Loader2, Palette, RefreshCw, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StructuredEditor } from "@/components/structured/structured-editor";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { FORMATS, PLATFORMS, composeCaption } from "../platforms.js";
import { postContentSchema } from "../schemas.js";
import { PostPreview } from "./post-preview";

const FULL_SPEC = schemaToSpec(postContentSchema);
const FORMAT_FIELDS = { CAROUSEL: ["slides"], STORY: ["frames"], SHORT_VIDEO: ["scenes", "audio"] };
const ALWAYS = ["hook", "caption", "hashtags", "callToAction", "altText", "visualIdea"];

function specFor(post, isPromotion) {
  const keep = new Set([...ALWAYS, ...(FORMAT_FIELDS[post.format] ?? []), ...(isPromotion ? ["promotion"] : [])]);
  return { ...FULL_SPEC, fields: FULL_SPEC.fields.filter((f) => keep.has(f.key)) };
}

export function PostEditor({ base, postId, businessName, canEdit, canGenerate, aiConfigured, onClose, onChanged }) {
  const [post, setPost] = useState(null);
  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const url = `${base}/posts/${postId}`;

  function apply(p) {
    setPost(p);
    setDraft(p.content ? structuredClone(p.content) : null);
    setMeta({ title: p.title, date: p.scheduledDate, status: p.status, isPromotion: p.isPromotion });
  }
  async function load() {
    apply(await apiRequest(url));
  }
  useEffect(() => {
    let cancelled = false;
    apiRequest(url)
      .then((p) => !cancelled && apply(p))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const spec = useMemo(() => (post ? specFor(post, meta?.isPromotion) : null), [post, meta?.isPromotion]);
  const dirty = post && (JSON.stringify(draft) !== JSON.stringify(post.content) || meta.title !== post.title || meta.date !== post.scheduledDate || meta.status !== post.status || meta.isPromotion !== post.isPromotion);

  async function run(kind, fn) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run("save", async () => {
      const body = {};
      if (meta.title !== post.title) body.title = meta.title;
      if (meta.date !== post.scheduledDate) body.date = meta.date;
      if (meta.status !== post.status) body.status = meta.status;
      if (meta.isPromotion !== post.isPromotion) body.isPromotion = meta.isPromotion;
      if (draft && JSON.stringify(draft) !== JSON.stringify(post.content)) body.content = draft;
      apply(await apiRequest(url, { method: "PATCH", body }));
      setNotice("Saved.");
      await onChanged();
    });

  const write = () =>
    run("generate", async () => {
      const r = await apiRequest(`${base}/posts/generate`, { method: "POST", body: { postIds: [postId], ...(feedback.trim() ? { feedback: feedback.trim() } : {}) } });
      if (r.missing.length) throw new Error("The AI did not return this post. Please try again.");
      setFeedback("");
      await load();
      await onChanged();
      setNotice(post.content ? "Rewritten — the previous version is in the history." : "Written.");
    });

  const remove = () =>
    run("delete", async () => {
      await apiRequest(url, { method: "DELETE" });
      await onChanged();
      onClose();
    });

  async function copy() {
    await navigator.clipboard.writeText([draft.hook, composeCaption(draft)].filter(Boolean).join("\n\n"));
    setNotice("Caption copied to the clipboard.");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{post ? post.title : "Post"}</DialogTitle>
          <DialogDescription>{post ? `${PLATFORMS[post.platform].label} · ${FORMATS[post.format]} · ${post.scheduledDate}` : "Loading…"}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {!post ? (
            error ? <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert> : <Skeleton className="h-96 w-full" />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-5">
                {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
                {notice && <Alert variant="success"><Check /><AlertDescription>{notice}</AlertDescription></Alert>}
                {post.isMock && <Badge variant="warning">Sample data from the mock AI provider</Badge>}
                <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-[1fr_160px_140px]">
                  <div className="grid gap-1.5"><Label htmlFor="pe-title">Title</Label><Input id="pe-title" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label htmlFor="pe-date">Date</Label><Input id="pe-date" type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="pe-status">Status</Label>
                    <NativeSelect id="pe-status" value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
                      <option value="IDEA">Idea</option><option value="DRAFT">Draft</option><option value="READY">Ready</option>
                    </NativeSelect>
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-3">
                    <input type="checkbox" className="size-4 accent-primary" checked={meta.isPromotion} onChange={(e) => setMeta({ ...meta, isPromotion: e.target.checked })} /> Promotion post
                  </label>
                </fieldset>

                {canGenerate && aiConfigured && (
                  <div className="space-y-2 rounded-xl border border-highlight/40 bg-accent/40 p-4">
                    <Label htmlFor="pe-feedback">{post.content ? "What should change? (optional)" : "Anything specific to include? (optional)"}</Label>
                    <Textarea id="pe-feedback" rows={2} maxLength={1000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                    <Button size="sm" onClick={write} disabled={busy !== null}>
                      {busy === "generate" ? <Loader2 className="animate-spin" /> : <RefreshCw />} {post.content ? "Rewrite with AI" : "Write with AI"}
                    </Button>
                  </div>
                )}

                {draft ? (
                  <fieldset disabled={!canEdit}>
                    <StructuredEditor spec={spec} value={draft} onChange={setDraft} />
                  </fieldset>
                ) : (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">This post is still an idea. Write it with AI to get the caption, hashtags and the rest.</p>
                )}

                {post.revisions.length > 0 && (
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}><History /> History ({post.revisions.length})</Button>
                    {showHistory && (
                      <ul className="divide-y rounded-xl border text-sm">
                        {post.revisions.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span>v{r.version} · {r.source === "AI" ? "AI" : "edited"} · {new Date(r.createdAt).toLocaleString()}</span>
                            {canEdit && r.version !== post.version && (
                              <Button size="sm" variant="outline" onClick={() => { setDraft(structuredClone(r.content)); setNotice(`Loaded v${r.version}. Save to restore it.`); }}>Restore</Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="lg:sticky lg:top-0 lg:self-start">
                {draft ? <PostPreview post={post} content={draft} businessName={businessName} /> : <Skeleton className="h-64 w-full" />}
              </div>
            </div>
          )}
        </DialogBody>
        {post && (
          <DialogFooter>
            {canEdit && <Button variant="ghost" className="mr-auto text-muted-foreground" onClick={remove} disabled={busy !== null}><Trash2 /> Delete</Button>}
            {draft && <Button variant="outline" onClick={copy}><Copy /> Copy caption</Button>}
            {canEdit && <Button variant="outline" asChild><Link href={`/design/new?post=${post.id}`}><Palette /> Design this post</Link></Button>}
            {canEdit && <Button onClick={save} disabled={!dirty || busy !== null}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Check />} Save</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
