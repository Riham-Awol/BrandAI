import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <Icon className="size-5" />
        </span>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
