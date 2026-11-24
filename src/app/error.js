"use client";

import { ErrorState } from "@/components/layout/error-state";
import { Button } from "@/components/ui/button";

export default function Error({ reset }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <ErrorState description="An unexpected error occurred. Our logs have the details." action={<Button onClick={reset}>Try again</Button>} />
    </div>
  );
}
