import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AdminMfaNotice() {
  return (
    <Card className="max-w-xl gap-3">
      <h2 className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" /> Two-factor sign-in required</h2>
      <p className="text-sm text-muted-foreground">The admin area can see every workspace, so it needs two-factor sign-in on your account.</p>
      <Button className="w-fit" asChild><Link href="/settings">Turn it on</Link></Button>
    </Card>
  );
}
