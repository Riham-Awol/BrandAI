import { cn } from "@/lib/utils";

function Progress({ value = 0, className, label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-highlight transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export { Progress };
