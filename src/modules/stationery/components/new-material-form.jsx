"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Check, Info, Loader2, RefreshCw, Wand2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { GeneratingState } from "@/components/studio/generating-state";
import { cn } from "@/lib/utils";
import { GROUPS, MATERIAL_KINDS } from "../catalog.js";
import { SvgPreview } from "./material-fields";

const NEW = "__new__";

export function NewMaterialForm({ workspaceId, businesses, ai, defaultKind, defaultBusinessId }) {
  const router = useRouter();
  const [form, setForm] = useState({ businessId: defaultBusinessId ?? businesses[0]?.id ?? NEW, newBusinessName: "", kind: MATERIAL_KINDS[defaultKind] ? defaultKind : "BUSINESS_CARD", brief: "", personName: "", personTitle: "" });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const kind = MATERIAL_KINDS[form.kind];

  async function generate() {
    if (form.businessId === NEW && !form.newBusinessName.trim()) return setError("Enter the business name.");
    setBusy("generate");
    setError(null);
    try {
      let businessId = form.businessId;
      if (businessId === NEW) {
        businessId = (await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses`, { method: "POST", body: { name: form.newBusinessName.trim(), stage: "STARTING" } })).id;
        set("businessId", businessId);
      }
      const person = kind.fields.includes("person") ? { ...(form.personName ? { name: form.personName } : {}), ...(form.personTitle ? { title: form.personTitle } : {}) } : undefined;
      const data = await apiRequest(`/api/v1/workspaces/${workspaceId}/materials/options`, { method: "POST", body: { businessId, kind: form.kind, brief: form.brief, person } });
      setResult({ ...data, businessId, kind: form.kind });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function save(i) {
    setBusy(`save-${i}`);
    try {
      const m = await apiRequest(`/api/v1/workspaces/${workspaceId}/materials`, { method: "POST", body: { businessId: result.businessId, kind: result.kind, spec: result.options[i].spec, isMock: result.isMock === true } });
      router.push(`/stationery/materials/${m.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {ai.isMock && <Alert variant="info"><Info /><AlertTitle>Test mode</AlertTitle><AlertDescription>The mock AI provider is active. Suggestions are sample data for testing.</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="gap-6">
          {Object.entries(GROUPS).map(([group, label]) => (
            <fieldset key={group} className="space-y-2">
              <legend className="text-sm font-medium">{label}</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(MATERIAL_KINDS).filter(([, k]) => k.group === group).map(([key, k]) => (
                  <button key={key} type="button" aria-pressed={form.kind === key} onClick={() => { set("kind", key); setResult(null); }} className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", form.kind === key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>
                    {k.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-sm text-muted-foreground">{kind.label}: {kind.size}. {kind.ai ? "AI suggests three concepts and the wording; you can edit everything." : "Three layouts using your logo, colours and business details."}</p>
          {kind.fields.includes("person") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="n-person">{kind.label === "Business card" ? "Name on the card" : "Name (optional)"}</Label><Input id="n-person" value={form.personName} onChange={(e) => set("personName", e.target.value)} placeholder="Defaults to your name" /></div>
              <div className="grid gap-1.5"><Label htmlFor="n-title">Job title</Label><Input id="n-title" value={form.personTitle} onChange={(e) => set("personTitle", e.target.value)} /></div>
            </div>
          )}
          {kind.ai && (
            <div className="grid gap-1.5">
              <Label htmlFor="n-brief">Brief (optional)</Label>
              <Textarea id="n-brief" rows={3} value={form.brief} onChange={(e) => set("brief", e.target.value)} placeholder={form.kind === "LABEL" || form.kind === "PACKAGING" ? "Product, size and any facts to print, e.g. 'Seeded rye, 800 g, ingredients: rye flour, water, seeds, salt'" : "e.g. Staff T-shirts for market days, friendly and bold"} />
              <p className="text-xs text-muted-foreground">Weights, ingredients and claims are only used if you write them here.</p>
            </div>
          )}
        </Card>
        <Card className="gap-5 lg:sticky lg:top-24 lg:self-start">
          <div className="grid gap-1.5">
            <Label htmlFor="n-business">Business</Label>
            <NativeSelect id="n-business" value={form.businessId} onChange={(e) => set("businessId", e.target.value)}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value={NEW}>+ A new business</option>
            </NativeSelect>
          </div>
          {form.businessId === NEW && (
            <div className="grid gap-1.5"><Label htmlFor="n-new">Business name</Label><Input id="n-new" value={form.newBusinessName} onChange={(e) => set("newBusinessName", e.target.value)} /></div>
          )}
          <Button size="lg" onClick={generate} disabled={busy !== null || (kind.ai && !ai.configured)}>
            {busy === "generate" ? <Loader2 className="animate-spin" /> : <Wand2 />} {kind.ai ? "Suggest 3 designs" : "Show 3 layouts"}
          </Button>
          {kind.ai && !ai.configured && <p className="text-xs text-muted-foreground">AI is not configured on this server.</p>}
        </Card>
      </div>

      {busy === "generate" && kind.ai && <GeneratingState title="designs" />}
      {result && busy !== "generate" && (
        <section aria-labelledby="opt-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="opt-title" className="font-display text-2xl font-semibold">Choose a design</h2>
            <Button variant="outline" onClick={generate} disabled={busy !== null}><RefreshCw /> {kind.ai ? "Suggest again" : "Refresh"}</Button>
          </div>
          {!result.brandApproved && <Alert variant="info"><Info /><AlertDescription>No approved brand identity yet — neutral colours are used. <Link className="font-medium underline" href="/brand">Create a brand identity</Link>.</AlertDescription></Alert>}
          {!result.detailsSaved && ["BUSINESS_CARD", "LETTERHEAD", "PACKAGING"].includes(result.kind) && (
            <Alert variant="info"><Info /><AlertDescription>Add your address, phone and company numbers in <Link className="font-medium underline" href={`/stationery/details?business=${result.businessId}`}>Business details</Link> to print them.</AlertDescription></Alert>
          )}
          <ul className="grid gap-5 md:grid-cols-3">
            {result.options.map((o, i) => (
              <li key={i}>
                <Card className="h-full gap-3 p-4">
                  <SvgPreview svg={o.views[0].svg} label={`Option ${i + 1}: ${o.spec.name}`} />
                  {o.views[1] && <SvgPreview svg={o.views[1].svg} label={`Option ${i + 1} ${o.views[1].label}`} background={o.views[1].previewBackground} className="max-h-40" />}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{o.spec.name}</h3>
                    {result.isMock && <Badge variant="warning">Mock</Badge>}
                  </div>
                  <Button className="mt-auto" onClick={() => save(i)} disabled={busy !== null}>{busy === `save-${i}` ? <Loader2 className="animate-spin" /> : <Check />} Use this design</Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
