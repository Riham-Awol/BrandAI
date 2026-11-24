"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { businessProfileSchema } from "@/validation/profile.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const STAGES = [["IDEA", "Idea"], ["STARTING", "Starting"], ["OPERATING", "Operating"], ["ESTABLISHED", "Established"]];

const LISTS = [
  { name: "products", title: "Products", description: "Physical or digital goods you sell.", empty: { name: "", priceRange: "", description: "" }, fields: [["name", "Name"], ["priceRange", "Price range"], ["description", "Description", "textarea"]] },
  { name: "services", title: "Services", description: "Services you offer.", empty: { name: "", priceRange: "", description: "" }, fields: [["name", "Name"], ["priceRange", "Price range"], ["description", "Description", "textarea"]] },
  { name: "locations", title: "Locations", description: "Where you operate. The first primary location is used as your main market.", empty: { label: "", city: "", region: "", country: "", isPrimary: false, isOnline: false }, fields: [["label", "Label"], ["city", "City"], ["region", "Region"], ["country", "Country"], ["isPrimary", "Primary location", "checkbox"], ["isOnline", "Online only", "checkbox"]] },
  { name: "audiences", title: "Target audiences", description: "Customer segments you serve.", empty: { name: "", demographics: "", description: "", needs: "", isPrimary: false }, fields: [["name", "Segment name"], ["demographics", "Demographics"], ["description", "Description", "textarea"], ["needs", "Needs", "textarea"], ["isPrimary", "Primary segment", "checkbox"]] },
  { name: "problems", title: "Customer problems", description: "Problems your customers have and how you solve them.", empty: { problem: "", solution: "" }, fields: [["problem", "Problem", "textarea"], ["solution", "How you solve it", "textarea"], ["severity", "Severity", "severity"]] },
  { name: "competitors", title: "Competitors", description: "Who else your customers consider.", empty: { name: "", website: "", description: "", strengths: "", weaknesses: "" }, fields: [["name", "Name"], ["website", "Website", "url"], ["description", "Description", "textarea"], ["strengths", "Strengths", "textarea"], ["weaknesses", "Weaknesses", "textarea"]] },
  { name: "goals", title: "Business goals", description: "What you want to achieve and how you'll measure it.", empty: { title: "", timeframe: "", metric: "", description: "" }, fields: [["title", "Goal"], ["timeframe", "Timeframe"], ["metric", "Metric"], ["description", "Description", "textarea"]] },
];

/** Normalizes nulls to "" so inputs stay controlled. */
function toFormValues(profile) {
  const out = { ...profile };
  for (const key of ["industry", "description", "valueProposition", "businessModel"]) out[key] = profile[key] ?? "";
  for (const list of LISTS) {
    out[list.name] = (profile[list.name] ?? []).map((item) => ({ ...list.empty, ...Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v ?? (typeof list.empty[k] === "boolean" ? false : "")])) }));
  }
  return out;
}

export function ProfileEditor({ workspaceId, businessId, initialProfile, canEdit, onSaved, submitLabel = "Save profile" }) {
  const [status, setStatus] = useState(null);
  const form = useForm({ resolver: zodResolver(businessProfileSchema), defaultValues: toFormValues(initialProfile) });
  const { register, handleSubmit, formState, setError } = form;
  const { errors, isSubmitting } = formState;

  async function onSubmit(values) {
    setStatus(null);
    try {
      const result = await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses/${businessId}/profile`, { method: "PUT", body: values });
      setStatus({ ok: true, message: "Profile saved. Review and approve it below so Brand AI can reuse it." });
      onSaved?.(result);
    } catch (error) {
      if (error.code === "VALIDATION_ERROR" && error.details) {
        for (const [field, messages] of Object.entries(error.details)) setError(field, { message: messages[0] });
      }
      setStatus({ ok: false, message: error.message });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, () => setStatus({ ok: false, message: "Please fix the highlighted fields." }))} noValidate className="space-y-6">
      <fieldset disabled={!canEdit} className="space-y-6">
        <Card className="gap-5">
          <CardHeader>
            <CardTitle>Business basics</CardTitle>
            <CardDescription>The core facts every Brand AI studio uses.</CardDescription>
          </CardHeader>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="name" label="Business name" error={errors.name}>{(a) => <Input {...a} {...register("name")} />}</FormField>
            <FormField id="industry" label="Industry" error={errors.industry}>{(a) => <Input {...a} {...register("industry")} />}</FormField>
            <FormField id="stage" label="Stage" error={errors.stage}>
              {(a) => <NativeSelect {...a} {...register("stage")}>{STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>}
            </FormField>
          </div>
          <FormField id="description" label="Description" error={errors.description}>{(a) => <Textarea rows={3} {...a} {...register("description")} />}</FormField>
          <FormField id="valueProposition" label="Value proposition" error={errors.valueProposition}>{(a) => <Textarea rows={2} {...a} {...register("valueProposition")} />}</FormField>
          <FormField id="businessModel" label="Business model" error={errors.businessModel}>{(a) => <Textarea rows={2} {...a} {...register("businessModel")} />}</FormField>
        </Card>
        {LISTS.map((list) => (
          <ListSection key={list.name} list={list} form={form} />
        ))}
      </fieldset>

      {status && (
        <Alert variant={status.ok ? "success" : "destructive"}>
          {status.ok ? <CheckCircle2 /> : <AlertCircle />}
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}
      {canEdit && (
        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Save />} {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

function ListSection({ list, form }) {
  const { control, register, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: list.name });
  const listErrors = formState.errors[list.name];
  return (
    <Card className="gap-4">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{list.title}</CardTitle>
          <CardDescription>{list.description}</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ ...list.empty })}>
          <Plus /> Add
        </Button>
      </CardHeader>
      {fields.length === 0 && <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nothing added yet.</p>}
      <ol className="space-y-3">
        {fields.map((field, i) => (
          <li key={field.id} className="rounded-xl border bg-background/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {list.fields.map(([name, label, type]) => {
                const id = `${list.name}-${i}-${name}`;
                const error = listErrors?.[i]?.[name];
                const path = `${list.name}.${i}.${name}`;
                if (type === "checkbox") {
                  return (
                    <label key={name} htmlFor={id} className="flex items-center gap-2 text-sm">
                      <Checkbox id={id} {...register(path)} /> {label}
                    </label>
                  );
                }
                return (
                  <FormField key={name} id={id} label={label} error={error} className={type === "textarea" ? "sm:col-span-2" : undefined}>
                    {(a) =>
                      type === "textarea" ? (
                        <Textarea rows={2} {...a} {...register(path)} />
                      ) : type === "severity" ? (
                        <NativeSelect {...a} {...register(path, { setValueAs: (v) => v || undefined })}>
                          <option value="">Not set</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </NativeSelect>
                      ) : (
                        <Input type={type === "url" ? "url" : "text"} {...a} {...register(path)} />
                      )
                    }
                  </FormField>
                );
              })}
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => remove(i)}>
                <Trash2 /> Remove
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
