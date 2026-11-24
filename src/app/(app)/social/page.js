import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Megaphone, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listSocialProjects } from "@/modules/social/service.js";

export const metadata = { title: "Social Media Studio" };

export default function SocialPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Studio"
        title="Social Media Studio"
        description="A month of on-brand posts — captions, hashtags, carousels, stories and video scripts — ready to publish."
        actions={<Button asChild><Link href="/social/new"><Plus /> New monthly plan</Link></Button>}
      />
      <Suspense fallback={<div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireUserOrRedirect("/social");
  const { active } = await getActiveWorkspace(user.id);
  const projects = active ? await listSocialProjects(user, active.id) : [];
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No social plans yet"
        description="Pick a month and your platforms. Brand AI writes posts in your approved brand voice."
        action={<Button asChild><Link href="/social/new">Plan a month of posts</Link></Button>}
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {projects.map((p) => (
        <li key={p.id}>
          <Card className="relative h-full gap-4 transition-shadow hover:shadow-lift">
            <div>
              <h2 className="truncate text-lg font-semibold"><Link href={`/social/${p.id}`} className="after:absolute after:inset-0">{p.name}</Link></h2>
              <p className="text-sm text-muted-foreground">Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>{p.completedSections} of {p.totalSections} planning steps</span><ArrowRight className="size-4" /></div>
              <Progress value={(p.completedSections / p.totalSections) * 100} label={`${p.name} progress`} />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
