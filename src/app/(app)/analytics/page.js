import { Suspense } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBusinesses } from "@/server/businesses/service.js";
import { loadOr404 } from "@/server/http/page-helpers.js";
import { getAnalytics, getAnalyticsPermissions, listReports } from "@/modules/analytics/service.js";
import { analyticsQuerySchema } from "@/modules/analytics/schemas.js";
import { AnalyticsDashboard } from "@/modules/analytics/components/analytics-dashboard";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage({ searchParams }) {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-48 w-full" /><Skeleton className="h-72 w-full" /></div>}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }) {
  const user = await requireUserOrRedirect("/analytics");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const parsed = analyticsQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : { days: 30 };
  const businesses = await listBusinesses(user, active.id);
  if (!businesses.length) {
    return <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Create a business first. <Link className="underline" href="/launch">Start in the Launch Studio</Link></p>;
  }
  const [report, reports, perms] = await Promise.all([loadOr404(() => getAnalytics(user, active.id, query)), listReports(user, active.id, { businessId: query.businessId }).catch(() => []), getAnalyticsPermissions(user, active.id)]);
  const latest = reports.find((r) => r.periodDays === query.days && (r.businessId ?? null) === (query.businessId ?? null)) ?? null;
  return (
    <AnalyticsDashboard
      workspaceId={active.id}
      businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
      initialReport={report}
      initialQuery={{ days: query.days, businessId: query.businessId }}
      latestReport={latest ? JSON.parse(JSON.stringify(latest)) : null}
      canGenerate={perms.canGenerate}
    />
  );
}
