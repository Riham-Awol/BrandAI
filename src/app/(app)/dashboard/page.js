import { Suspense } from "react";
import { Building2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PRODUCT_PHASES } from "@/lib/roadmap";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { getUsageSummary } from "@/server/usage/service.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";

export const metadata = { title: "Overview" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

const METRIC_LABELS = {
  AI_TEXT_REQUESTS: { label: "AI text generations", format: (v) => Number(v).toLocaleString() },
  AI_IMAGE_REQUESTS: { label: "AI image generations", format: (v) => Number(v).toLocaleString() },
  AI_COST_MICRO_USD: { label: "AI spend", format: (v) => `$${(Number(v) / 1_000_000).toFixed(2)}` },
  STORAGE_BYTES: { label: "Storage", format: (v) => `${(Number(v) / 1024 / 1024).toFixed(1)} MB` },
};

async function Dashboard() {
  const user = await requireUserOrRedirect();
  const { active } = await getActiveWorkspace(user.id);
  if (!active) {
    return <EmptyState icon={Building2} title="No workspace yet" description="Your account is not a member of any workspace." />;
  }
  const canSeeUsage = active.role !== "VIEWER";
  const [businesses, usage] = await Promise.all([listBusinesses(user, active.id), canSeeUsage ? getUsageSummary(user, active.id) : []]);

  return (
    <div className="space-y-10">
      <PageHeader eyebrow={active.name} title={`Welcome, ${user.name.split(" ")[0]}`} description="Here is where your business, brand and marketing come together." />

      <section aria-labelledby="businesses-heading" className="space-y-4">
        <h2 id="businesses-heading" className="text-xl font-semibold">Businesses</h2>
        {businesses.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Your first business starts here"
            description="The Business Launch Studio (Phase 1) will guide you from an idea to a complete business profile. It is not available yet."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <Card key={b.id}>
                <CardHeader>
                  <CardTitle>{b.name}</CardTitle>
                  <CardDescription>{b.industry ?? "Industry not set"}</CardDescription>
                </CardHeader>
                <Badge variant="outline" className="w-fit capitalize">{b.stage.toLowerCase()}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      {usage.length > 0 && (
        <section aria-labelledby="usage-heading" className="space-y-4">
          <h2 id="usage-heading" className="text-xl font-semibold">This month&apos;s usage</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {usage.map((u) => {
              const meta = METRIC_LABELS[u.metric];
              const pct = Math.min(100, Math.round((Number(u.used) / Math.max(1, Number(u.limit))) * 100));
              return (
                <Card key={u.metric} className="gap-3 p-4 sm:p-5">
                  <p className="text-sm text-muted-foreground">{meta?.label ?? u.metric}</p>
                  <p className="font-display text-xl font-semibold sm:text-2xl">
                    {meta?.format(u.used) ?? u.used}
                    <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">/ {meta?.format(u.limit) ?? u.limit}</span>
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${meta?.label} used`}>
                    <div className="h-full rounded-full bg-highlight" style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="journey-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="journey-heading" className="text-xl font-semibold">Your business journey</h2>
          <p className="text-sm text-muted-foreground">Studios unlock as each phase ships.</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_PHASES.slice(0, 9).map((p) => (
            <li key={p.key} className="flex gap-4 rounded-xl border bg-card p-4 shadow-soft">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary font-display text-sm font-semibold text-secondary-foreground">{p.phase}</span>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold leading-tight">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.summary}</p>
                <Badge variant={p.available ? "success" : "outline"}>{p.available ? "Available" : "Coming soon"}</Badge>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
    </div>
  );
}
