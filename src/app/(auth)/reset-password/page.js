import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Choose a new password" };

export default function Page() {
  return (
    <>
      <AuthHeading title="Choose a new password" description="Signing in again will be required on all devices." />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
