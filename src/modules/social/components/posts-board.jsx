"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, CalendarPlus, Download, Loader2, Plus, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { FORMATS, PLATFORMS, weekday } from "../platforms.js";
import { PostEditor } from "./post-editor";

const STATUS = { IDEA: ["Idea", "outline"], DRAFT: ["Draft", "secondary"], READY: ["Ready", "success"] };
const BATCH = 6;

export function PostsBoard({ base, project, ai, hasCalendar }) {
  const [posts, setPosts] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState("ALL");
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [adding, setAdding] = useState(false);
  const { canEdit, canGenerate } = project.permissions;

  const load = useCallback(async () => setPosts(await apiRequest(`${base}/posts`)), [base]);
  useEffect(() => {
    let cancelled = false;
    apiRequest(`${base}/posts`)
      .then((p) => !cancelled && setPosts(p))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [base]);

  const visible = useMemo(() => (posts ?? []).filter((p) => filter === "ALL" || p.status === filter || p.platform === filter), [posts, filter]);
  const ideas = (posts ?? []).filter((p) => p.status === "IDEA");

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

  const fromCalendar = () =>
    run("calendar", async () => {
      const r = await apiRequest(`${base}/posts/from-calendar`, { method: "POST" });
      await load();
      setNotice(r.created ? `${r.created} post ideas added from the calendar.` : "These calendar ideas are already on the board.");
    });

  const writeBatch = (ids) =>
    run("write", async () => {
      const r = await apiRequest(`${base}/posts/generate`, { method: "POST", body: { postIds: ids } });
      setSelected(new Set());
      await load();
      setNotice(`${r.written.length} post${r.written.length === 1 ? "" : "s"} written.${r.missing.length ? ` ${r.missing.length} could not be written — try them again.` : ""}`);
    });

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < BATCH) next.add(id);
    setSelected(next);
  }

  if (!posts) return error ? <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert> : <Skeleton className="h-96 w-full" />;
  const canWrite = canGenerate && ai.configured;

  return (
    <Card className="gap-5 p-5 sm:p-7">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Posts</h2>
          <p className="text-sm text-muted-foreground">Write posts in batches of up to {BATCH}, then edit, preview and mark them ready.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && hasCalendar && <Button variant="outline" size="sm" onClick={fromCalendar} disabled={busy !== null}>{busy === "calendar" ? <Loader2 className="animate-spin" /> : <CalendarPlus />} Add calendar ideas</Button>}
          {canEdit && <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus /> Add a post</Button>}
          <Button variant="outline" size="sm" asChild><a href={`${base}/export?format=csv`} download><Download /> CSV</a></Button>
          <Button variant="outline" size="sm" asChild><a href={`${base}/export?format=markdown`} download><Download /> Markdown</a></Button>
        </div>
      </header>

      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><Sparkles /><AlertDescription>{notice}</AlertDescription></Alert>}
      {busy === "write" && <Alert variant="info"><Loader2 className="animate-spin" /><AlertDescription>Writing posts… this can take a minute on the free AI tier.</AlertDescription></Alert>}

      {posts.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="No posts yet"
          description={hasCalendar ? "Turn your content calendar into post ideas, or add a single post." : "Generate the content calendar first, or add a single post with the quick tool."}
          action={canEdit && hasCalendar ? <Button onClick={fromCalendar} disabled={busy !== null}><CalendarPlus /> Add calendar ideas</Button> : null}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="pb-filter" className="sr-only">Filter</Label>
            <NativeSelect id="pb-filter" className="h-9 w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="ALL">All posts ({posts.length})</option>
              {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l} ({posts.filter((p) => p.status === k).length})</option>)}
              {project.input.platforms.map((p) => <option key={p} value={p}>{PLATFORMS[p].label}</option>)}
            </NativeSelect>
            {canWrite && (
              <>
                <Button size="sm" onClick={() => writeBatch([...selected])} disabled={selected.size === 0 || busy !== null}><Sparkles /> Write selected ({selected.size})</Button>
                {ideas.length > 0 && <Button size="sm" variant="outline" onClick={() => writeBatch(ideas.slice(0, BATCH).map((p) => p.id))} disabled={busy !== null}>Write next {Math.min(BATCH, ideas.length)} ideas</Button>}
              </>
            )}
          </div>
          <ul className="divide-y rounded-xl border">
            {visible.map((p) => {
              const [label, variant] = STATUS[p.status];
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  {canWrite && <Checkbox aria-label={`Select ${p.title}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} disabled={!selected.has(p.id) && selected.size >= BATCH} />}
                  <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{weekday(p.scheduledDate)} {p.scheduledDate.slice(8)}</span>
                  <button type="button" onClick={() => setOpenId(p.id)} className="min-w-0 flex-1 text-left outline-none focus-visible:underline">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{PLATFORMS[p.platform].label} · {FORMATS[p.format]}{p.isPromotion ? " · promotion" : ""}{p.content?.hook ? ` — ${p.content.hook}` : ""}</span>
                  </button>
                  {p.checks?.warnings.length > 0 && <AlertTriangle className="size-4 shrink-0 text-warning" aria-label={`${p.checks.warnings.length} warnings`} />}
                  <Badge variant={variant}>{label}</Badge>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {openId && (
        <PostEditor
          base={base}
          postId={openId}
          businessName={project.business.name}
          canEdit={canEdit}
          canGenerate={canGenerate}
          aiConfigured={ai.configured}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
      {adding && <AddPostDialog base={base} project={project} canWrite={canWrite} onClose={() => setAdding(false)} onCreated={async (post) => { setAdding(false); await load(); setOpenId(post.id); }} />}
    </Card>
  );
}

/** Quick tool: one post, optionally written immediately. */
function AddPostDialog({ base, project, canWrite, onClose, onCreated }) {
  const platforms = project.input.platforms;
  const [form, setForm] = useState({ title: "", date: `${project.input.month}-01`, platform: platforms[0], format: PLATFORMS[platforms[0]].formats[0], isPromotion: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === "platform" && !PLATFORMS[v].formats.includes(f.format) ? { format: PLATFORMS[v].formats[0] } : {}) }));

  async function submit(generate) {
    setBusy(true);
    setError(null);
    try {
      onCreated(await apiRequest(`${base}/posts`, { method: "POST", body: { ...form, generate } }));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a post</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="grid gap-1.5"><Label htmlFor="ap-title">What is the post about?</Label><Input id="ap-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. New rye loaf launch" /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5"><Label htmlFor="ap-date">Date</Label><Input id="ap-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="ap-platform">Platform</Label><NativeSelect id="ap-platform" value={form.platform} onChange={(e) => set("platform", e.target.value)}>{platforms.map((p) => <option key={p} value={p}>{PLATFORMS[p].label}</option>)}</NativeSelect></div>
            <div className="grid gap-1.5"><Label htmlFor="ap-format">Format</Label><NativeSelect id="ap-format" value={form.format} onChange={(e) => set("format", e.target.value)}>{PLATFORMS[form.platform].formats.map((f) => <option key={f} value={f}>{FORMATS[f]}</option>)}</NativeSelect></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={form.isPromotion} onChange={(e) => set("isPromotion", e.target.checked)} /> Promotion post</label>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => submit(false)} disabled={busy || !form.title.trim()}>Save as idea</Button>
          {canWrite && <Button onClick={() => submit(true)} disabled={busy || !form.title.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Write with AI</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
