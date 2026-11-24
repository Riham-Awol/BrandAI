import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Reset your password" };

export default function Page() {
  return (
    <>
      <AuthHeading title="Reset your password" description="Enter your email and we'll send you a secure reset link." />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ForgotPasswordForm />
      </Suspense>
    </>
  );
}
