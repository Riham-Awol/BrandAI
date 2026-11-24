"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { forgotPasswordSchema } from "@/validation/auth.js";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await apiRequest("/api/v1/auth/password/forgot", { method: "POST", body: values });
      setSent(true);
    } catch (error) {
      setFormError(error.message);
    }
  }

  if (sent) {
    return (
      <div className="grid gap-5">
        <Alert variant="success">
          <MailCheck />
          <AlertDescription>If an account exists for that email, we sent a reset link. It expires in 30 minutes.</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField id="email" label="Email" error={formState.errors.email}>
        {(a11y) => <Input type="email" autoComplete="email" {...a11y} {...register("email")} />}
      </FormField>
      <Button type="submit" size="lg" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 className="animate-spin" />}
        Send reset link
      </Button>
      <Link href="/login" className="text-center text-sm font-medium text-muted-foreground hover:text-foreground">Back to sign in</Link>
    </form>
  );
}
