"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2, Palette } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { STYLE_KEYWORDS, brandInputSchema } from "../schemas.js";

const NEW = "__new__";
const formSchema = brandInputSchema
  .extend({ businessId: z.string(), newBusinessName: z.string().trim().max(160).optional() })
  .refine((v) => v.businessId !== NEW || (v.newBusinessName && v.newBusinessName.length > 0), { path: ["newBusinessName"], message: "Enter the business name." })
  .refine((v) => v.businessId !== "", { path: ["businessId"], message: "Choose a business." });

export function NewBrandForm({ workspaceId, businesses, defaultBusinessId }) {
  const router = useRouter();
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, control, setValue, formState } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { businessId: defaultBusinessId ?? (businesses[0]?.id ?? NEW), newBusinessName: "", styleKeywords: [], colorPreferences: "", avoid: "", inspiration: "" },
  });
  const businessId = useWatch({ control, name: "businessId" });
  const keywords = useWatch({ control, name: "styleKeywords" }) ?? [];
  const { errors, isSubmitting } = formState;

  function toggleKeyword(k) {
    const next = keywords.includes(k) ? keywords.filter((x) => x !== k) : keywords.length < 5 ? [...keywords, k] : keywords;
    setValue("styleKeywords", next, { shouldValidate: true });
  }

  async function onSubmit({ businessId: chosen, newBusinessName, ...prefs }) {
    setFormError(null);
    try {
      let id = chosen;
      if (chosen === NEW) {
        const business = await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses`, { method: "POST", body: { name: newBusinessName, stage: "STARTING" } });
        id = business.id;
      }
      const project = await apiRequest(`/api/v1/workspaces/${workspaceId}/brand-projects`, { method: "POST", body: { businessId: id, ...prefs } });
      router.push(`/brand/${project.id}`);
    } catch (e) {
      setFormError(e.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="gap-6">
        {formError && <Alert variant="destructive"><AlertCircle /><AlertDescription>{formError}</AlertDescription></Alert>}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Style (choose up to 5)</legend>
          <div className="flex flex-wrap gap-2">
            {STYLE_KEYWORDS.map((k) => {
              const on = keywords.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleKeyword(k)}
                  className={cn("rounded-full border px-3.5 py-1.5 text-sm capitalize transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </fieldset>
        <FormField id="colorPreferences" label="Colour preferences (optional)" error={errors.colorPreferences}>
          {(a) => <Input placeholder="e.g. warm earthy tones, deep green" {...a} {...register("colorPreferences")} />}
        </FormField>
        <FormField id="avoid" label="Anything to avoid? (optional)" error={errors.avoid}>
          {(a) => <Input placeholder="e.g. neon colours, script fonts" {...a} {...register("avoid")} />}
        </FormField>
        <FormField id="inspiration" label="Inspiration (optional)" hint="Describe brands, places or moods you like. Don't paste other companies' logos." error={errors.inspiration}>
          {(a) => <Textarea rows={3} {...a} {...register("inspiration")} />}
        </FormField>
      </Card>
      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="gap-5">
          <FormField id="businessId" label="Business" hint="Brand AI uses this business's approved profile." error={errors.businessId}>
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
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Palette />} Start brand identity
          </Button>
        </Card>
      </div>
    </form>
  );
}
