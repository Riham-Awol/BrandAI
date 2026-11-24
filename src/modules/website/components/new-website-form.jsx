"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Briefcase, LayoutTemplate, Loader2, Rocket, ShoppingBag, Store, Wand2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { GeneratingState } from "@/components/studio/generating-state";
import { cn } from "@/lib/utils";
import { THEMES, WEBSITE_TYPES } from "../catalog.js";

const NEW = "__new__";
const TYPE_ICONS = { BUSINESS: Store, LANDING: Rocket, PORTFOLIO: Briefcase, STORE: ShoppingBag };

export function NewWebsiteForm({ workspaceId, businesses, ai, defaultBusinessId }) {
  const router = useRouter();
  const [form, setForm] = useState({ businessId: defaultBusinessId ?? businesses[0]?.id ?? NEW, newBusinessName: "", type: "BUSINESS", theme: "modern", brief: "" });
  const [busy, setBusy] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function create(generate) {
    const errs = {};
    if (form.businessId === NEW && !form.newBusinessName.trim()) errs.newBusinessName = "Enter the business name.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(generate ? "ai" : "template");
    setFormError(null);
    try {
      let businessId = form.businessId;
      if (businessId === NEW) {
        businessId = (await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses`, { method: "POST", body: { name: form.newBusinessName.trim(), stage: "STARTING" } })).id;
        set("businessId", businessId);
      }
      const site = await apiRequest(`/api/v1/workspaces/${workspaceId}/websites`, { method: "POST", body: { businessId, type: form.type, theme: form.theme, brief: form.brief, generate } });
      router.push(`/websites/${site.id}`);
    } catch (err) {
      setFormError(err.message);
      setBusy(null);
    }
  }

  if (busy === "ai") return <GeneratingState title="website" />;

  return (
    <div className="space-y-6">
      {!ai.configured && (
        <Alert variant="info"><AlertCircle /><AlertTitle>AI writing is not available on this server yet</AlertTitle><AlertDescription>You can still start from a template and write the text yourself.</AlertDescription></Alert>
      )}
      {ai.isMock && <Alert variant="info"><AlertCircle /><AlertTitle>Test mode</AlertTitle><AlertDescription>The mock AI provider is active. Results are sample data for testing.</AlertDescription></Alert>}
      {formError && <Alert variant="destructive"><AlertCircle /><AlertDescription>{formError}</AlertDescription></Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="gap-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Type of website</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(WEBSITE_TYPES).map(([key, t]) => {
                const Icon = TYPE_ICONS[key];
                const on = form.type === key;
                return (
                  <button key={key} type="button" aria-pressed={on} onClick={() => set("type", key)} className={cn("flex gap-3 rounded-xl border p-4 text-left transition-colors", on ? "border-primary bg-accent/60 ring-1 ring-primary" : "bg-card hover:bg-accent/40")}>
                    <Icon className="mt-0.5 size-5 shrink-0 text-highlight" />
                    <span className="space-y-1">
                      <span className="block font-medium">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.description}</span>
                      <span className="block text-xs text-muted-foreground">Pages: {t.pages.map((p) => p.title).join(", ")}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Style</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(THEMES).map(([key, t]) => (
                <button key={key} type="button" aria-pressed={form.theme === key} onClick={() => set("theme", key)} className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", form.theme === key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")} title={t.description}>
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor="brief">What should the website do? (optional)</Label>
            <Textarea id="brief" rows={4} value={form.brief} onChange={(e) => set("brief", e.target.value)} placeholder="e.g. Get more café wholesale customers and promote our weekend bread classes." />
            <p className="text-xs text-muted-foreground">The AI uses your approved profile, brand voice and products. It never invents prices, contact details or reviews.</p>
          </div>
        </Card>
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="businessId">Business</Label>
              <NativeSelect id="businessId" value={form.businessId} onChange={(e) => set("businessId", e.target.value)}>
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                <option value={NEW}>+ A new business</option>
              </NativeSelect>
            </div>
            {form.businessId === NEW && (
              <div className="grid gap-1.5">
                <Label htmlFor="newBusinessName">Business name</Label>
                <Input id="newBusinessName" value={form.newBusinessName} onChange={(e) => set("newBusinessName", e.target.value)} aria-invalid={Boolean(errors.newBusinessName) || undefined} />
                {errors.newBusinessName && <p className="text-xs font-medium text-destructive">{errors.newBusinessName}</p>}
              </div>
            )}
            <Button size="lg" onClick={() => create(true)} disabled={busy !== null || !ai.configured}><Wand2 /> Write my website</Button>
            <Button variant="outline" onClick={() => create(false)} disabled={busy !== null}>
              {busy === "template" ? <Loader2 className="animate-spin" /> : <LayoutTemplate />} Start from template
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
