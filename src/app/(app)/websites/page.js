import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, Globe, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listWebsites } from "@/modules/website/service.js";
import { WEBSITE_TYPES } from "@/modules/website/catalog.js";

export const metadata = { title: "Website Builder" };

export default function WebsitesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Studio"
        title="Website Builder"
        description="Business sites, landing pages, portfolios and online stores — written from your business profile, styled with your brand, published in one click."
        actions={<Button asChild><Link href="/websites/new"><Plus /> New website</Link></Button>}
      />
      <Suspense fallback={<div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}>
        <List />
      </Suspense>
    </div>
  );
}

const STATUS = { DRAFT: ["secondary", "Draft"], PUBLISHED: ["success", "Published"], UNPUBLISHED: ["warning", "Unpublished"] };

async function List() {
  const user = await requireUserOrRedirect("/websites");
  const { active } = await getActiveWorkspace(user.id);
  const sites = active ? await listWebsites(user, active.id) : [];
  if (sites.length === 0) {
    return (
      <EmptyState
        icon={Globe}
        title="No websites yet"
        description="Pick a type — business site, landing page, portfolio or store. Brand AI writes it from your approved business profile."
        action={<Button asChild><Link href="/websites/new">Create a website</Link></Button>}
      />
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {sites.map((s) => {
        const [variant, label] = STATUS[s.status];
        return (
          <li key={s.id}>
            <Card className="relative h-full gap-3 transition-shadow hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold"><Link href={`/websites/${s.id}`} className="after:absolute after:inset-0">{s.name}</Link></h2>
                  <p className="text-sm text-muted-foreground">{WEBSITE_TYPES[s.type].label} · {s.business.name}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {s.isMock && <Badge variant="warning">Mock</Badge>}
                  <Badge variant={variant}>{label}</Badge>
                </div>
              </div>
              {s.status === "PUBLISHED" && (
                <a href={s.urls.domainUrl ?? s.urls.path} target="_blank" rel="noopener noreferrer" className="relative z-10 inline-flex w-fit items-center gap-1 text-sm text-highlight underline-offset-4 hover:underline">
                  {s.urls.domainUrl ? s.customDomain : s.urls.path} <ExternalLink className="size-3.5" />
                </a>
              )}
              <p className="text-xs text-muted-foreground">Updated {new Date(s.updatedAt).toLocaleDateString()}</p>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
