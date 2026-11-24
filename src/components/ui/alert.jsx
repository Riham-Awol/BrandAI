import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      destructive: "border-destructive/30 bg-destructive/5 text-destructive [&>svg]:text-current",
      success: "border-success/30 bg-success/5 text-success [&>svg]:text-current",
      info: "border-highlight/50 bg-accent/60 text-accent-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
function AlertTitle({ className, ...props }) {
  return <div data-slot="alert-title" className={cn("col-start-2 font-semibold", className)} {...props} />;
}
function AlertDescription({ className, ...props }) {
  return <div data-slot="alert-description" className={cn("col-start-2 text-sm opacity-90", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
