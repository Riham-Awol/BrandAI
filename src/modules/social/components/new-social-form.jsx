"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Loader2, Megaphone } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PLATFORMS, PLATFORM_KEYS } from "../platforms.js";

const NEW = "__new__";

function nextMonth() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7);
}

export function NewSocialForm({ workspaceId, businesses, defaultBusinessId }) {
  const router = useRouter();
  const [form, setForm] = useState({ businessId: defaultBusinessId ?? businesses[0]?.id ?? NEW, newBusinessName: "", month: nextMonth(), platforms: ["INSTAGRAM", "FACEBOOK"], postsPerWeek: 4, focus: "", includePromotions: true });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const togglePlatform = (p) => set("platforms", form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (form.platforms.length === 0) errs.platforms = "Choose at least one platform.";
    if (form.businessId === NEW && !form.newBusinessName.trim()) errs.newBusinessName = "Enter the business name.";
    if (!/^\d{4}-\d{2}$/.test(form.month)) errs.month = "Choose a month.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError(null);
    try {
      let businessId = form.businessId;
      if (businessId === NEW) businessId = (await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses`, { method: "POST", body: { name: form.newBusinessName.trim(), stage: "STARTING" } })).id;
      const project = await apiRequest(`/api/v1/workspaces/${workspaceId}/social-projects`, {
        method: "POST",
        body: { businessId, month: form.month, platforms: form.platforms, postsPerWeek: Number(form.postsPerWeek), focus: form.focus, includePromotions: form.includePromotions },
      });
      router.push(`/social/${project.id}`);
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="gap-6">
        {formError && <Alert variant="destructive"><AlertCircle /><AlertDescription>{formError}</AlertDescription></Alert>}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Platforms</legend>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_KEYS.map((p) => {
              const on = form.platforms.includes(p);
              return (
                <button key={p} type="button" aria-pressed={on} onClick={() => togglePlatform(p)} className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>
                  {PLATFORMS[p].label}
                </button>
              );
            })}
          </div>
          {errors.platforms && <p className="text-xs font-medium text-destructive">{errors.platforms}</p>}
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="month">Month</Label>
            <Input id="month" type="month" value={form.month} onChange={(e) => set("month", e.target.value)} aria-invalid={Boolean(errors.month) || undefined} />
            {errors.month && <p className="text-xs font-medium text-destructive">{errors.month}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="postsPerWeek">Posts per week (all platforms)</Label>
            <NativeSelect id="postsPerWeek" value={form.postsPerWeek} onChange={(e) => set("postsPerWeek", e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((n) => <option key={n} value={n}>{n}</option>)}
            </NativeSelect>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="focus">Focus this month (optional)</Label>
          <Textarea id="focus" rows={3} value={form.focus} onChange={(e) => set("focus", e.target.value)} placeholder="e.g. Launch of our rye loaf, Valentine's Day, 10% off weekday breakfasts" />
          <p className="text-xs text-muted-foreground">Include real offers here — the AI won&apos;t invent discounts.</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={form.includePromotions} onChange={(e) => set("includePromotions", e.target.checked)} /> Include promotion posts</label>
      </Card>
      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="businessId">Business</Label>
            <NativeSelect id="businessId" value={form.businessId} onChange={(e) => set("businessId", e.target.value)}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value={NEW}>+ A new business</option>
            </NativeSelect>
            <p className="text-xs text-muted-foreground">Uses its approved profile, brand voice and marketing plan.</p>
          </div>
          {form.businessId === NEW && (
            <div className="grid gap-1.5">
              <Label htmlFor="newBusinessName">Business name</Label>
              <Input id="newBusinessName" value={form.newBusinessName} onChange={(e) => set("newBusinessName", e.target.value)} aria-invalid={Boolean(errors.newBusinessName) || undefined} />
              {errors.newBusinessName && <p className="text-xs font-medium text-destructive">{errors.newBusinessName}</p>}
            </div>
          )}
          <Button type="submit" size="lg" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Megaphone />} Start social plan</Button>
        </Card>
      </div>
    </form>
  );
}
