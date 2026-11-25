"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { loginSchema } from "@/validation/auth.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

function safeCallbackUrl(value) {
  // Only allow same-site relative paths (prevents open redirects).
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState(null);
  const [needsCode, setNeedsCode] = useState(false);
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", otp: "" } });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values) {
    setFormError(null);
    const result = await signIn("credentials", { ...values, otp: needsCode ? values.otp : "", redirect: false });
    if (!result || result.error) {
      if (result?.error === "MFA_REQUIRED") {
        setNeedsCode(true);
        return;
      }
      setFormError(
        result?.error === "MFA_INVALID" ? "That code didn't work. Enter the newest code from your app, or a recovery code."
          : result?.error?.includes("Too many") ? "Too many sign-in attempts. Please wait a few minutes and try again." : "Incorrect email or password.",
      );
      return;
    }
    router.replace(safeCallbackUrl(params.get("callbackUrl")));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      {params.get("signedout") === "1" && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription>You were signed out on every device. Sign in again to continue.</AlertDescription>
        </Alert>
      )}
      {params.get("reset") === "1" && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription>Your password was reset. Sign in with your new password.</AlertDescription>
        </Alert>
      )}
      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField id="email" label="Email" error={errors.email}>
        {(a11y) => <Input type="email" autoComplete="email" placeholder="you@company.com" {...a11y} {...register("email")} />}
      </FormField>
      <FormField
        id="password"
        label="Password"
        error={errors.password}
        labelAction={<Link href="/forgot-password" className="text-xs font-medium text-muted-foreground hover:text-foreground">Forgot password?</Link>}
      >
        {(a11y) => <Input type="password" autoComplete="current-password" {...a11y} {...register("password")} />}
      </FormField>
      {needsCode && (
        <FormField id="otp" label="Authentication code" error={errors.otp} hint="Open your authenticator app and enter the 6-digit code, or use one of your recovery codes.">
          {(a11y) => <Input autoFocus inputMode="text" autoComplete="one-time-code" placeholder="123456" {...a11y} {...register("otp")} />}
        </FormField>
      )}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        {needsCode ? "Verify and sign in" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to Brand AI?{" "}
        <Link href="/register" className="font-semibold text-foreground hover:underline">Create an account</Link>
      </p>
    </form>
  );
}
