import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { RegisterForm } from "@/components/auth/register-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Create your account" };

export default function Page() {
  return (
    <>
      <AuthHeading title="Create your account" description="Start with a free workspace. No credit card required." />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <RegisterForm />
      </Suspense>
    </>
  );
}
