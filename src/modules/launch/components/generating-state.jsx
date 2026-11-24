"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function GeneratingState({ title }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-highlight/40 bg-accent/50 px-4 py-3 text-sm">
        <Sparkles className="size-4 animate-pulse text-highlight" />
        <span>
          Generating your {title.toLowerCase()}… <span className="text-muted-foreground">({seconds}s — detailed sections can take up to two minutes)</span>
        </span>
      </div>
      <div className="space-y-3"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-20 w-full" /></div>
      <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
    </div>
  );
}
