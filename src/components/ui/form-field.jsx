import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Accessible field wrapper for React Hook Form inputs. Wires label, hint and
 * error message ids; pass the error from formState.errors[name].
 */
export function FormField({ id, label, hint, error, className, children, labelAction }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children({ id, "aria-invalid": Boolean(error) || undefined, "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined })}
      {hint && !error && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} className="text-xs font-medium text-destructive">{error.message}</p>}
    </div>
  );
}
