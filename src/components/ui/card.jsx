import { cn } from "@/lib/utils";

function Card({ className, ...props }) {
  return <div data-slot="card" className={cn("flex flex-col gap-5 rounded-xl border bg-card p-6 text-card-foreground shadow-soft", className)} {...props} />;
}
function CardHeader({ className, ...props }) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1.5", className)} {...props} />;
}
function CardTitle({ className, ...props }) {
  return <h3 data-slot="card-title" className={cn("font-display text-lg font-semibold leading-tight", className)} {...props} />;
}
function CardDescription({ className, ...props }) {
  return <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn(className)} {...props} />;
}
function CardFooter({ className, ...props }) {
  return <div data-slot="card-footer" className={cn("flex items-center gap-3", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
