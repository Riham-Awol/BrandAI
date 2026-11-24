import { cn } from "@/lib/utils";

/** Native checkbox with brand styling (keeps form semantics simple). */
function Checkbox({ className, ...props }) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn("size-4 shrink-0 cursor-pointer rounded border-input accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

export { Checkbox };
