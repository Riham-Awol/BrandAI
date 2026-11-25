import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { VerifyEmail } from "@/components/auth/verify-email";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Confirm your email" };

export default function Page() {
  return (
    <>
      <AuthHeading title="Confirm your email" description="One click and your address is confirmed." />
      <Suspense fallback={<Skeleton className="h-24 w-full" />}><VerifyEmail /></Suspense>
    </>
  );
}
