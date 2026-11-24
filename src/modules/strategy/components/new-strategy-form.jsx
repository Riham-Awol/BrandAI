"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2, Target } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES, GOAL_LABELS, PRIMARY_GOALS } from "../schemas.js";

const NEW = "__new__";
const formSchema = z
  .object({
    businessId: z.string().min(1, "Choose a business."),
    newBusinessName: z.string().trim().max(160).optional(),
    primaryGoal: z.enum(PRIMARY_GOALS),
    monthlyBudget: z.string().trim().refine((v) => v === "" || (Number(v) >= 0 && Number(v) <= 100_000_000), "Enter a valid amount or leave empty."),
    currency: z.enum(CURRENCIES),
    timeframeMonths: z.enum(["3", "6", "12"]),
    focusMarkets: z.string().trim().max(500).optional(),
    constraints: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.businessId !== NEW || (v.newBusinessName?.length ?? 0) > 0, { path: ["newBusinessName"], message: "Enter the business name." });

export function NewStrategyForm({ workspaceId, businesses, defaultBusinessId }) {
  const router = useRouter();
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, control, formState } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { businessId: defaultBusinessId ?? businesses[0]?.id ?? NEW, newBusinessName: "", primaryGoal: "awareness", monthlyBudget: "", currency: "USD", timeframeMonths: "6", focusMarkets: "", constraints: "" },
  });
  const businessId = useWatch({ control, name: "businessId" });
  const { errors, isSubmitting } = formState;

  async function onSubmit({ businessId: chosen, newBusinessName, monthlyBudget, timeframeMonths, ...rest }) {
    setFormError(null);
    try {
      let id = chosen;
      if (chosen === NEW) id = (await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses`, { method: "POST", body: { name: newBusinessName, stage: "STARTING" } })).id;
      const body = { businessId: id, ...rest, timeframeMonths: Number(timeframeMonths), ...(monthlyBudget !== "" ? { monthlyBudget: Number(monthlyBudget) } : {}) };
      const project = await apiRequest(`/api/v1/workspaces/${workspaceId}/strategy-projects`, { method: "POST", body });
      router.push(`/strategy/${project.id}`);
    } catch (e) {
      setFormError(e.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="gap-6">
        {formError && <Alert variant="destructive"><AlertCircle /><AlertDescription>{formError}</AlertDescription></Alert>}
        <FormField id="primaryGoal" label="Main goal" error={errors.primaryGoal}>
          {(a) => <NativeSelect {...a} {...register("primaryGoal")}>{PRIMARY_GOALS.map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}</NativeSelect>}
        </FormField>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField id="monthlyBudget" label="Monthly budget" hint="Leave empty for a suggestion." error={errors.monthlyBudget}>
            {(a) => <Input inputMode="decimal" placeholder="e.g. 500" {...a} {...register("monthlyBudget")} />}
          </FormField>
          <FormField id="currency" label="Currency" error={errors.currency}>
            {(a) => <NativeSelect {...a} {...register("currency")}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</NativeSelect>}
          </FormField>
          <FormField id="timeframeMonths" label="Timeframe" error={errors.timeframeMonths}>
            {(a) => <NativeSelect {...a} {...register("timeframeMonths")}><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option></NativeSelect>}
          </FormField>
        </div>
        <FormField id="focusMarkets" label="Focus markets (optional)" error={errors.focusMarkets}>
          {(a) => <Input placeholder="e.g. Leeds city centre, online UK-wide" {...a} {...register("focusMarkets")} />}
        </FormField>
        <FormField id="constraints" label="Constraints (optional)" hint="Time, skills, channels you can't use…" error={errors.constraints}>
          {(a) => <Textarea rows={3} {...a} {...register("constraints")} />}
        </FormField>
      </Card>
      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="gap-5">
          <FormField id="businessId" label="Business" hint="Uses its approved profile and brand." error={errors.businessId}>
            {(a) => (
              <NativeSelect {...a} {...register("businessId")}>
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                <option value={NEW}>+ A new business</option>
              </NativeSelect>
            )}
          </FormField>
          {businessId === NEW && (
            <FormField id="newBusinessName" label="Business name" error={errors.newBusinessName}>
              {(a) => <Input {...a} {...register("newBusinessName")} />}
            </FormField>
          )}
          <Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : <Target />} Start marketing strategy</Button>
        </Card>
      </div>
    </form>
  );
}
