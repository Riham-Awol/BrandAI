import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Plus, Rocket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listLaunchProjects } from "@/modules/launch/service.js";

export const metadata = { title: "Business Launch Studio" };

export default function LaunchPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Studio"
        title="Business Launch Studio"
        description="Turn an idea into a validated business profile and an actionable launch plan."
        actions={<Button asChild><Link href="/launch/new"><Plus /> New launch plan</Link></Button>}
      />
      <Suspense fallback={<div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}>
        <ProjectList />
      </Suspense>
    </div>
  );
}

async function ProjectList() {
  const user = await requireUserOrRedirect("/launch");
  const { active } = await getActiveWorkspace(user.id);
  const projects = active ? await listLaunchProjects(user, active.id) : [];
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={Rocket}
        title="No launch plans yet"
        description="Describe your idea once. Brand AI analyses it, suggests names, defines your audience, maps competitors and builds your plan step by step."
        action={<Button asChild><Link href="/launch/new">Start your first plan</Link></Button>}
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {projects.map((p) => (
        <li key={p.id}>
          <Card className="relative h-full gap-4 transition-shadow hover:shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">
                  <Link href={`/launch/${p.id}`} className="after:absolute after:inset-0 focus-visible:underline">{p.business.name}</Link>
                </h2>
                <p className="text-sm text-muted-foreground">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
              </div>
              <Badge variant="outline" className="capitalize">{p.business.stage.toLowerCase()}</Badge>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{p.completedSections} of {p.totalSections} sections</span>
                <ArrowRight className="size-4" />
              </div>
              <Progress value={(p.completedSections / p.totalSections) * 100} label={`${p.business.name} progress`} />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
