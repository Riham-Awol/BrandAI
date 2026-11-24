import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Palette, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listBrandProjects } from "@/modules/brand/service.js";

export const metadata = { title: "Brand Identity Studio" };

export default function BrandPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Studio"
        title="Brand Identity Studio"
        description="Logo, colours, typography, tagline, personality and voice — approved once, reused everywhere."
        actions={<Button asChild><Link href="/brand/new"><Plus /> New brand identity</Link></Button>}
      />
      <Suspense fallback={<div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireUserOrRedirect("/brand");
  const { active } = await getActiveWorkspace(user.id);
  const projects = active ? await listBrandProjects(user, active.id) : [];
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={Palette}
        title="No brand identities yet"
        description="Start from a business in this workspace. Brand AI uses its approved profile, so you never repeat yourself."
        action={<Button asChild><Link href="/brand/new">Create a brand identity</Link></Button>}
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {projects.map((p) => (
        <li key={p.id}>
          <Card className="relative h-full gap-4 transition-shadow hover:shadow-lift">
            <div>
              <h2 className="truncate text-lg font-semibold">
                <Link href={`/brand/${p.id}`} className="after:absolute after:inset-0">{p.business.name}</Link>
              </h2>
              <p className="text-sm text-muted-foreground">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
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
