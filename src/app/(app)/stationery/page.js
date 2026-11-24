import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Building2, FileText, Plus, Printer, Shirt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listMaterials } from "@/modules/stationery/materials-service.js";
import { listDocuments } from "@/modules/stationery/documents-service.js";
import { listCompanyProfiles } from "@/modules/stationery/profile-service.js";
import { GROUPS, MATERIAL_KINDS } from "@/modules/stationery/catalog.js";
import { DOCUMENT_TYPES, STATUS_LABELS } from "@/modules/stationery/documents.js";
import { formatMoney } from "@/modules/stationery/money.js";

export const metadata = { title: "Stationery & Merchandise" };

export default function StationeryPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Studio"
        title="Stationery & Merchandise"
        description="Business cards, letterheads, invoices, quotations, company profiles, uniforms, merchandise, labels and packaging — all in your brand."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link href="/stationery/details"><Building2 /> Business details</Link></Button>
            <Button asChild><Link href="/stationery/materials/new"><Plus /> New branded item</Link></Button>
          </div>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Quick start">
        {[
          { href: "/stationery/materials/new?kind=BUSINESS_CARD", icon: Printer, title: "Business cards & letterheads", text: "Print-ready with bleed, using your details." },
          { href: "/stationery/materials/new?kind=TSHIRT", icon: Shirt, title: "Merchandise & uniforms", text: "T-shirts, polos, bags and mugs with mockups." },
          { href: "/stationery/documents/new?type=INVOICE", icon: FileText, title: "Invoices & quotations", text: "Numbered, branded, totals calculated." },
          { href: "/stationery/profiles/new", icon: BookOpen, title: "Company profile", text: "A printable brochure about your business." },
        ].map(({ href, icon: Icon, title, text }) => (
          <Card key={href} className="relative gap-2 transition-shadow hover:shadow-lift">
            <Icon className="size-5 text-highlight" />
            <h2 className="font-semibold"><Link href={href} className="after:absolute after:inset-0">{title}</Link></h2>
            <p className="text-sm text-muted-foreground">{text}</p>
          </Card>
        ))}
      </section>
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-32" /></div>}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const user = await requireUserOrRedirect("/stationery");
  const { active } = await getActiveWorkspace(user.id);
  if (!active) return null;
  const [materials, documents, profiles] = await Promise.all([listMaterials(user, active.id), listDocuments(user, active.id), listCompanyProfiles(user, active.id)]);
  return (
    <div className="space-y-10">
      <section aria-labelledby="mat-title" className="space-y-4">
        <h2 id="mat-title" className="font-display text-2xl font-semibold">Branded items</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet — start with a business card or a T-shirt above.</p>
        ) : (
          Object.entries(GROUPS).map(([group, label]) => {
            const items = materials.filter((m) => MATERIAL_KINDS[m.kind].group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {items.map((m) => (
                    <li key={m.id}>
                      <Card className="relative h-full gap-2 p-3 transition-shadow hover:shadow-lift">
                        <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-md bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin rendered SVG */}
                          <img src={`/api/v1/workspaces/${active.id}/materials/${m.id}/render?v=${m.version}`} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                        </div>
                        <p className="truncate font-medium"><Link href={`/stationery/materials/${m.id}`} className="after:absolute after:inset-0">{m.name}</Link></p>
                        <p className="truncate text-xs text-muted-foreground">{MATERIAL_KINDS[m.kind].label} · {m.business.name}</p>
                        {m.isMock && <Badge variant="warning" className="absolute top-5 left-5">Mock</Badge>}
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>

      <section aria-labelledby="doc-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="doc-title" className="font-display text-2xl font-semibold">Invoices &amp; quotations</h2>
          <Button variant="outline" size="sm" asChild><Link href="/stationery/documents">View all</Link></Button>
        </div>
        {documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents yet.</p> : (
          <ul className="divide-y rounded-xl border bg-card">
            {documents.slice(0, 5).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link className="font-medium hover:underline" href={`/stationery/documents/${d.id}`}>{DOCUMENT_TYPES[d.type]} {d.number} · {d.customer.name}</Link>
                <span className="flex items-center gap-3"><Badge variant="secondary">{STATUS_LABELS[d.status]}</Badge><span className="tabular-nums">{formatMoney(d.totalMinor, d.currency)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="prof-title" className="space-y-4">
        <h2 id="prof-title" className="font-display text-2xl font-semibold">Company profiles</h2>
        {profiles.length === 0 ? <p className="text-sm text-muted-foreground">No company profile yet.</p> : (
          <ul className="grid gap-4 md:grid-cols-2">
            {profiles.map((p) => (
              <li key={p.id}>
                <Card className="relative gap-1">
                  <p className="font-semibold"><Link href={`/stationery/profiles/${p.id}`} className="after:absolute after:inset-0">{p.name}</Link></p>
                  <p className="text-sm text-muted-foreground">{p.completedSections} of {p.totalSections} sections</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
