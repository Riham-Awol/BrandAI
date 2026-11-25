"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Confirmation needs a click (POST), so link scanners that pre-open emails can't confirm on their own. */
export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState("idle");
  const [error, setError] = useState(null);
  async function confirm() {
    setState("busy");
    try {
      await apiRequest("/api/v1/auth/verify-email", { method: "POST", body: { token } });
      setState("done");
    } catch (e) {
      setError(e.message);
      setState("idle");
    }
  }
  if (state === "done") {
    return (
      <div className="grid gap-4">
        <Alert variant="success"><CheckCircle2 /><AlertDescription>Your email is confirmed.</AlertDescription></Alert>
        <Button asChild><Link href="/dashboard">Continue to Brand AI</Link></Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error} You can send a new link from Settings.</AlertDescription></Alert>}
      <Button size="lg" disabled={!token || state === "busy"} onClick={confirm}>{state === "busy" && <Loader2 className="animate-spin" />} Confirm my email</Button>
    </div>
  );
}
