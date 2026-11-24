"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { AlertCircle, Loader2 } from "lucide-react";
import { registerSchema } from "@/validation/auth.js";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState(null);
  const { register, handleSubmit, setError, formState } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values) {
    setFormError(null);
    try {
      await apiRequest("/api/v1/auth/register", { method: "POST", body: values });
    } catch (error) {
      if (error.code === "VALIDATION_ERROR" && error.details) {
        for (const [field, messages] of Object.entries(error.details)) setError(field, { message: messages[0] });
      } else {
        setFormError(error.message);
      }
      return;
    }
    const result = await signIn("credentials", { email: values.email, password: values.password, redirect: false });
    if (result?.error) {
      router.replace("/login");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField id="name" label="Full name" error={errors.name}>
        {(a11y) => <Input autoComplete="name" placeholder="Your name" {...a11y} {...register("name")} />}
      </FormField>
      <FormField id="email" label="Work email" error={errors.email}>
        {(a11y) => <Input type="email" autoComplete="email" placeholder="you@company.com" {...a11y} {...register("email")} />}
      </FormField>
      <FormField id="password" label="Password" hint="At least 10 characters, including a number or symbol." error={errors.password}>
        {(a11y) => <Input type="password" autoComplete="new-password" {...a11y} {...register("password")} />}
      </FormField>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-foreground hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
