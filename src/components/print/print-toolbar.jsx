"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Screen-only toolbar for printable pages; A4 page rules apply when printing. */
export function PrintToolbar({ backHref, margin = "14mm" }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4 print:hidden">
      <style>{`@page{size:A4;margin:${margin}}@media print{html,body{background:#fff!important}}`}</style>
      <Button variant="outline" asChild><Link href={backHref}><ArrowLeft /> Back</Link></Button>
      <Button onClick={() => window.print()}><Printer /> Print / Save as PDF</Button>
    </div>
  );
}
