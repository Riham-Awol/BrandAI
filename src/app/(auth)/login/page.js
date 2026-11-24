import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Sign in" };

export default function Page() {
  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in to continue building your brand." />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LoginForm />
      </Suspense>
    </>
  );
}
