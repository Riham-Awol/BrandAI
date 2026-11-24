"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { passwordSchema } from "@/validation/common.js";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

const formSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(formSchema), defaultValues: { password: "", confirm: "" } });

  if (!token) {
    return (
      <div className="grid gap-5">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>This reset link is incomplete. Request a new one.</AlertDescription>
        </Alert>
        <Button asChild variant="outline"><Link href="/forgot-password">Request a new link</Link></Button>
      </div>
    );
  }

  async function onSubmit({ password }) {
    setFormError(null);
    try {
      await apiRequest("/api/v1/auth/password/reset", { method: "POST", body: { token, password } });
      router.replace("/login?reset=1");
    } catch (error) {
      setFormError(error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField id="password" label="New password" hint="At least 10 characters, including a number or symbol." error={formState.errors.password}>
        {(a11y) => <Input type="password" autoComplete="new-password" {...a11y} {...register("password")} />}
      </FormField>
      <FormField id="confirm" label="Confirm new password" error={formState.errors.confirm}>
        {(a11y) => <Input type="password" autoComplete="new-password" {...a11y} {...register("confirm")} />}
      </FormField>
      <Button type="submit" size="lg" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 className="animate-spin" />}
        Reset password
      </Button>
    </form>
  );
}
