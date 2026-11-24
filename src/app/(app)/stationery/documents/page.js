import Link from "next/link";
import { Suspense } from "react";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserOrRedirect } from "@/server/auth/session.js";
import { getActiveWorkspace } from "@/server/workspaces/active.js";
import { listDocuments } from "@/modules/stationery/documents-service.js";
import { DOCUMENT_TYPES, STATUS_LABELS } from "@/modules/stationery/documents.js";
import { formatMoney } from "@/modules/stationery/money.js";

export const metadata = { title: "Invoices & quotations" };

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Stationery & Merchandise"
        title="Invoices & quotations"
        description="Branded, numbered documents with totals calculated for you. Print or save as PDF to send."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link href="/stationery/documents/new?type=QUOTE"><Plus /> New quotation</Link></Button>
            <Button asChild><Link href="/stationery/documents/new?type=INVOICE"><Plus /> New invoice</Link></Button>
          </div>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <List />
      </Suspense>
    </div>
  );
}

const VARIANT = { DRAFT: "secondary", SENT: "default", PAID: "success", ACCEPTED: "success", DECLINED: "warning", VOID: "warning" };

async function List() {
  const user = await requireUserOrRedirect("/stationery/documents");
  const { active } = await getActiveWorkspace(user.id);
  const docs = active ? await listDocuments(user, active.id) : [];
  if (!docs.length) {
    return <EmptyState icon={FileText} title="No invoices or quotations yet" description="Create a quotation for a customer, then turn it into an invoice when they accept." action={<Button asChild><Link href="/stationery/documents/new?type=INVOICE">Create an invoice</Link></Button>} />;
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Invoices and quotations</caption>
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Number</th>
            <th scope="col" className="px-4 py-3 font-medium">Customer</th>
            <th scope="col" className="px-4 py-3 font-medium">Date</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {docs.map((d) => (
            <tr key={d.id} className="hover:bg-accent/40">
              <td className="px-4 py-3"><Link className="font-medium underline-offset-4 hover:underline" href={`/stationery/documents/${d.id}`}>{DOCUMENT_TYPES[d.type]} {d.number}</Link><p className="text-xs text-muted-foreground">{d.business.name}</p></td>
              <td className="px-4 py-3">{d.customer.name}{d.customer.company ? <span className="text-muted-foreground"> · {d.customer.company}</span> : null}</td>
              <td className="px-4 py-3 tabular-nums">{d.issueDate}</td>
              <td className="px-4 py-3"><div className="flex gap-1"><Badge variant={VARIANT[d.status]}>{STATUS_LABELS[d.status]}</Badge>{d.overdue && <Badge variant="warning">Overdue</Badge>}</div></td>
              <td className="px-4 py-3 text-right tabular-nums">{formatMoney(d.totalMinor, d.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
