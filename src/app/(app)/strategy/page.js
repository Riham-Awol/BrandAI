import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Plus, Target } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listStrategyProjects } from "@/modules/strategy/service.js";

export const metadata = { title: "Marketing Strategy Studio" };

export default function StrategyPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Studio"
        title="Marketing Strategy Studio"
        description="Personas, channels, budget, advertising and KPIs — one complete, approved marketing plan."
        actions={<Button asChild><Link href="/strategy/new"><Plus /> New marketing strategy</Link></Button>}
      />
      <Suspense fallback={<div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireUserOrRedirect("/strategy");
  const { active } = await getActiveWorkspace(user.id);
  const projects = active ? await listStrategyProjects(user, active.id) : [];
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No marketing strategies yet"
        description="Brand AI builds your strategy from the business profile and brand you already approved."
        action={<Button asChild><Link href="/strategy/new">Create a marketing strategy</Link></Button>}
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {projects.map((p) => (
        <li key={p.id}>
          <Card className="relative h-full gap-4 transition-shadow hover:shadow-lift">
            <div>
              <h2 className="truncate text-lg font-semibold"><Link href={`/strategy/${p.id}`} className="after:absolute after:inset-0">{p.business.name}</Link></h2>
              <p className="text-sm text-muted-foreground">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>{p.completedSections} of {p.totalSections} sections</span><ArrowRight className="size-4" /></div>
              <Progress value={(p.completedSections / p.totalSections) * 100} label={`${p.business.name} progress`} />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
