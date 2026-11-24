"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BUDGET_LABELS, BUDGET_RANGES, createLaunchProjectSchema } from "../schemas.js";

const STAGES = [
  ["IDEA", "Just an idea"],
  ["STARTING", "Getting started"],
  ["OPERATING", "Already operating"],
  ["ESTABLISHED", "Established business"],
];

export function IdeaForm({ workspaceId, businesses }) {
  const router = useRouter();
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, control, setError, formState } = useForm({
    resolver: zodResolver(createLaunchProjectSchema),
    defaultValues: { idea: "", businessName: "", country: "", city: "", stage: "IDEA", budget: "not_sure", audienceHint: "", goals: "", experience: "", businessId: "" },
  });
  const { errors, isSubmitting } = formState;
  const existing = useWatch({ control, name: "businessId" });

  async function onSubmit(values) {
    setFormError(null);
    try {
      const project = await apiRequest(`/api/v1/workspaces/${workspaceId}/launch-projects`, { method: "POST", body: values });
      router.push(`/launch/${project.id}`);
    } catch (error) {
      if (error.code === "VALIDATION_ERROR" && error.details) {
        for (const [field, messages] of Object.entries(error.details)) setError(field, { message: messages[0] });
      } else setFormError(error.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, () => setFormError("Please fix the highlighted fields."))}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
    >
      <Card className="gap-6">
        {formError && (
          <Alert variant="destructive"><AlertCircle /><AlertDescription>{formError}</AlertDescription></Alert>
        )}
        <FormField id="idea" label="Describe your business idea" hint="What will you sell, to whom, and what makes it different? The more specific, the better the results." error={errors.idea}>
          {(a11y) => <Textarea rows={6} placeholder="e.g. A neighbourhood bakery specialising in sourdough that also supplies local cafés…" {...a11y} {...register("idea")} />}
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="country" label="Country" error={errors.country}>
            {(a11y) => <Input autoComplete="country-name" placeholder="e.g. Kenya" {...a11y} {...register("country")} />}
          </FormField>
          <FormField id="city" label="City (optional)" error={errors.city}>
            {(a11y) => <Input autoComplete="address-level2" {...a11y} {...register("city")} />}
          </FormField>
          <FormField id="stage" label="Where are you today?" error={errors.stage}>
            {(a11y) => <NativeSelect {...a11y} {...register("stage")}>{STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>}
          </FormField>
          <FormField id="budget" label="Starting budget" error={errors.budget}>
            {(a11y) => <NativeSelect {...a11y} {...register("budget")}>{BUDGET_RANGES.map((b) => <option key={b} value={b}>{BUDGET_LABELS[b]}</option>)}</NativeSelect>}
          </FormField>
        </div>
        <FormField id="audienceHint" label="Who do you want to serve? (optional)" error={errors.audienceHint}>
          {(a11y) => <Textarea rows={2} {...a11y} {...register("audienceHint")} />}
        </FormField>
        <FormField id="goals" label="What do you want to achieve? (optional)" error={errors.goals}>
          {(a11y) => <Textarea rows={2} placeholder="e.g. Replace my salary within 18 months" {...a11y} {...register("goals")} />}
        </FormField>
        <FormField id="experience" label="Your experience and resources (optional)" error={errors.experience}>
          {(a11y) => <Textarea rows={2} {...a11y} {...register("experience")} />}
        </FormField>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="gap-5">
          {businesses.length > 0 && (
            <FormField id="businessId" label="Business" hint="Plan a new business, or use one you already manage here." error={errors.businessId}>
              {(a11y) => (
                <NativeSelect {...a11y} {...register("businessId")}>
                  <option value="">A new business</option>
                  {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </NativeSelect>
              )}
            </FormField>
          )}
          {!existing && (
            <FormField id="businessName" label="Business name (optional)" hint="No name yet? The studio will suggest some." error={errors.businessName}>
              {(a11y) => <Input {...a11y} {...register("businessName")} />}
            </FormField>
          )}
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Start launch plan
          </Button>
        </Card>
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Your answers are stored in this workspace and used only to generate your launch plan. You can edit everything later.
        </p>
      </div>
    </form>
  );
}
