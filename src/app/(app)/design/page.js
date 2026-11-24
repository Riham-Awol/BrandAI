import Link from "next/link";
import { Suspense } from "react";
import { Palette, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listDesigns } from "@/modules/design/service.js";
import { DESIGN_FORMATS, DESIGN_KINDS } from "@/modules/design/catalog.js";

export const metadata = { title: "Creative Design Studio" };

export default function DesignPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Studio"
        title="Creative Design Studio"
        description="Posters, flyers, ads, banners and social graphics — drawn with your approved logo, colours and fonts."
        actions={<Button asChild><Link href="/design/new"><Plus /> New design</Link></Button>}
      />
      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>}>
        <Gallery />
      </Suspense>
    </div>
  );
}

async function Gallery() {
  const user = await requireUserOrRedirect("/design");
  const { active } = await getActiveWorkspace(user.id);
  const designs = active ? await listDesigns(user, active.id) : [];
  if (designs.length === 0) {
    return (
      <EmptyState
        icon={Palette}
        title="No designs yet"
        description="Describe what you need — a poster, an offer, an event — and Brand AI creates three on-brand options to choose from."
        action={<Button asChild><Link href="/design/new">Create your first design</Link></Button>}
      />
    );
  }
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {designs.map((d) => {
        const f = DESIGN_FORMATS[d.format];
        return (
          <li key={d.id}>
            <Card className="relative h-full gap-3 p-4 transition-shadow hover:shadow-lift">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- same-origin rendered SVG */}
                <img src={`/api/v1/workspaces/${active.id}/designs/${d.id}/render?v=${d.version}`} alt="" loading="lazy" className="max-h-full max-w-full object-contain" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-semibold"><Link href={`/design/${d.id}`} className="after:absolute after:inset-0">{d.name}</Link></h2>
                <p className="truncate text-sm text-muted-foreground">{DESIGN_KINDS[d.kind].label} · {f.label.split(" ")[0]} · {d.business.name}</p>
              </div>
              {d.isMock && <Badge variant="warning" className="absolute top-6 left-6">Mock</Badge>}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
