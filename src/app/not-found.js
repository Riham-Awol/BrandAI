import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="space-y-4">
        <p className="font-display text-6xl font-semibold text-highlight">404</p>
        <h1 className="text-2xl font-semibold">This page does not exist</h1>
        <Button asChild><Link href="/">Go home</Link></Button>
      </div>
    </div>
  );
}
