import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ErrorState({ title = "Something went wrong", description, action, className }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center", className)}>
      <AlertTriangle className="mb-3 size-6 text-destructive" />
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
