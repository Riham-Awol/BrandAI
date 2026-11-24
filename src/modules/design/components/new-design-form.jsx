"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, Check, Info, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { GeneratingState } from "@/components/studio/generating-state";
import { cn } from "@/lib/utils";
import { DESIGN_FORMATS, DESIGN_KINDS, KIND_KEYS, TEMPLATES } from "../catalog.js";
import { DesignPreview } from "./design-preview";

const NEW = "__new__";

export function NewDesignForm({ workspaceId, businesses, ai, prefill }) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({
    businessId: prefill?.businessId ?? businesses[0]?.id ?? NEW,
    newBusinessName: "",
    kind: prefill?.kind ?? "POSTER",
    format: prefill?.format ?? DESIGN_KINDS[prefill?.kind ?? "POSTER"].formats[0],
    brief: prefill?.brief ?? "",
    details: prefill?.details ?? "",
    cta: prefill?.cta ?? "",
    imageFileId: "",
  }));
  const [createdBusinesses, setCreatedBusinesses] = useState([]);
  const allBusinesses = [...businesses, ...createdBusinesses];
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (form.businessId === NEW) return;
    let cancelled = false;
    apiRequest(`/api/v1/workspaces/${workspaceId}/designs/images?businessId=${form.businessId}`)
      .then((list) => !cancelled && setImages(list))
      .catch(() => !cancelled && setImages([]));
    return () => {
      cancelled = true;
    };
  }, [workspaceId, form.businessId]);

  const chooseKind = (kind) => setForm((f) => ({ ...f, kind, format: DESIGN_KINDS[kind].formats.includes(f.format) ? f.format : DESIGN_KINDS[kind].formats[0] }));

  async function generate(e) {
    e?.preventDefault();
    const errs = {};
    if (form.businessId === NEW && !form.newBusinessName.trim()) errs.newBusinessName = "Enter the business name.";
    if (form.brief.trim().length < 5) errs.brief = "Describe what the design is for.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setGenerating(true);
    setFormError(null);
    try {
      let businessId = form.businessId;
      if (businessId === NEW) {
        businessId = (await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses`, { method: "POST", body: { name: form.newBusinessName.trim(), stage: "STARTING" } })).id;
        setForm((f) => ({ ...f, businessId }));
        setCreatedBusinesses((list) => [...list, { id: businessId, name: form.newBusinessName.trim() }]);
      }
      const { newBusinessName: _ignored, ...rest } = form;
      const body = { ...rest, businessId, imageFileId: form.imageFileId || undefined, sourcePostId: prefill?.postId };
      setResult({ ...(await apiRequest(`/api/v1/workspaces/${workspaceId}/designs/generate`, { method: "POST", body })), format: form.format, kind: form.kind, businessId, imageFileId: form.imageFileId || null, brief: { brief: form.brief, details: form.details, cta: form.cta } });
    } catch (err) {
      setFormError(err.message);
      if (err.details) setErrors(Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, v[0]])));
    } finally {
      setGenerating(false);
    }
  }

  async function save(index) {
    setSaving(index);
    setFormError(null);
    try {
      const design = await apiRequest(`/api/v1/workspaces/${workspaceId}/designs`, {
        method: "POST",
        body: { businessId: result.businessId, kind: result.kind, format: result.format, brief: result.brief, spec: result.options[index].spec, imageFileId: result.imageFileId, sourcePostId: prefill?.postId ?? null, isMock: result.isMock === true },
      });
      router.push(`/design/${design.id}`);
    } catch (err) {
      setFormError(err.message);
      setSaving(null);
    }
  }

  const fmt = DESIGN_FORMATS[result?.format ?? form.format];
  const disabled = !ai.configured || generating;

  return (
    <div className="space-y-8">
      {!ai.configured && (
        <Alert variant="info"><AlertCircle /><AlertDescription>AI text generation isn&apos;t configured on this server (SERVICE_NOT_CONFIGURED). Ask an administrator to add a free AI provider key.</AlertDescription></Alert>
      )}
      {ai.isMock && (
        <Alert variant="info"><Info /><AlertDescription>The mock AI provider is active. Results are sample data for testing, not real designs.</AlertDescription></Alert>
      )}
      {prefill?.title && (
        <Alert variant="info"><Info /><AlertDescription>Designing for the social post “{prefill.title}”. The brief below was filled in from the post — edit it as you like.</AlertDescription></Alert>
      )}
      <form onSubmit={generate} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="gap-6">
          {formError && <Alert variant="destructive"><AlertCircle /><AlertDescription>{formError}</AlertDescription></Alert>}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">What are you making?</legend>
            <div className="flex flex-wrap gap-2">
              {KIND_KEYS.map((k) => (
                <button key={k} type="button" aria-pressed={form.kind === k} onClick={() => chooseKind(k)} className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", form.kind === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>
                  {DESIGN_KINDS[k].label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor="brief">Brief</Label>
            <Textarea id="brief" rows={4} value={form.brief} onChange={(e) => set("brief", e.target.value)} aria-invalid={Boolean(errors.brief) || undefined} aria-describedby={errors.brief ? "brief-err" : undefined} placeholder="e.g. Poster for our new rye loaf, launching this Saturday. Warm, inviting, for regulars and passers-by." />
            {errors.brief && <p id="brief-err" className="text-xs font-medium text-destructive">{errors.brief}</p>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="details">Facts to include (optional)</Label>
              <Textarea id="details" rows={3} value={form.details} onChange={(e) => set("details", e.target.value)} placeholder={"Date: Sat 14 March\nPrice: £4.50\nWhere: Kirkgate Market"} />
              <p className="text-xs text-muted-foreground">Dates, prices and offers are only used if you write them here.</p>
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="cta">Call to action (optional)</Label>
              <Input id="cta" value={form.cta} onChange={(e) => set("cta", e.target.value)} placeholder="e.g. Pre-order today" />
            </div>
          </div>
        </Card>
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="businessId">Business</Label>
              <NativeSelect id="businessId" value={form.businessId} onChange={(e) => set("businessId", e.target.value)}>
                {allBusinesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                <option value={NEW}>+ A new business</option>
              </NativeSelect>
              <p className="text-xs text-muted-foreground">Designs use its approved logo, colours and fonts.</p>
            </div>
            {form.businessId === NEW && (
              <div className="grid gap-1.5">
                <Label htmlFor="newBusinessName">Business name</Label>
                <Input id="newBusinessName" value={form.newBusinessName} onChange={(e) => set("newBusinessName", e.target.value)} aria-invalid={Boolean(errors.newBusinessName) || undefined} />
                {errors.newBusinessName && <p className="text-xs font-medium text-destructive">{errors.newBusinessName}</p>}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="format">Size</Label>
              <NativeSelect id="format" value={form.format} onChange={(e) => set("format", e.target.value)}>
                {DESIGN_KINDS[form.kind].formats.map((f) => <option key={f} value={f}>{DESIGN_FORMATS[f].label}</option>)}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="imageFileId">Photo (optional)</Label>
              <NativeSelect id="imageFileId" value={form.imageFileId} onChange={(e) => set("imageFileId", e.target.value)} aria-invalid={Boolean(errors.imageFileId) || undefined}>
                <option value="">No photo</option>
                {form.businessId !== NEW && images.map((i) => <option key={i.fileId} value={i.fileId}>{i.name}</option>)}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                {form.businessId === NEW ? "Add the business first; its brand asset photos can then be used." : images.length ? "From this business's brand assets." : "Upload photos under the business's brand assets to use them here."}
              </p>
              {errors.imageFileId && <p className="text-xs font-medium text-destructive">{errors.imageFileId}</p>}
            </div>
            <Button type="submit" size="lg" disabled={disabled}>{generating ? <Loader2 className="animate-spin" /> : <Wand2 />} Generate 3 designs</Button>
          </Card>
        </div>
      </form>

      {generating && <GeneratingState title="designs" />}
      {result && !generating && (
        <section aria-labelledby="options-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="options-title" className="font-display text-2xl font-semibold">Choose a design</h2>
              <p className="text-sm text-muted-foreground">Pick one to save — you can edit the text, layout and colours next.</p>
            </div>
            <Button variant="outline" onClick={generate} disabled={disabled}><RefreshCw /> Generate again</Button>
          </div>
          {!result.brandApproved && (
            <Alert variant="info"><Info /><AlertDescription>This business has no approved brand identity yet, so neutral colours and fonts are used. <Link className="font-medium underline" href="/brand">Create a brand identity</Link> to design on-brand.</AlertDescription></Alert>
          )}
          <ul className="grid gap-5 md:grid-cols-3">
            {result.options.map((o, i) => (
              <li key={i}>
                <Card className="h-full gap-4 p-4">
                  <DesignPreview svg={o.svg} width={fmt.width} height={fmt.height} label={`Design option ${i + 1}: ${o.spec.headline}`} />
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug">{o.spec.name}</h3>
                      {result.isMock && <Badge variant="warning">Mock</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{TEMPLATES[o.spec.template]} layout</p>
                    {o.warnings.length > 0 && <p className="text-xs text-warning">{o.warnings[0]}</p>}
                  </div>
                  <Button className="mt-auto" onClick={() => save(i)} disabled={saving !== null}>
                    {saving === i ? <Loader2 className="animate-spin" /> : <Check />} Use this design
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3.5" /> AI writes the copy and picks layouts; Brand AI draws them with your brand.</p>
        </section>
      )}
    </div>
  );
}
