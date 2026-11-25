"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  ["/analytics", "Overview"],
  ["/analytics/posts", "Post results"],
  ["/analytics/reports", "Saved reports"],
  ["/analytics/settings", "Tracking & privacy"],
];

export function AnalyticsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Analytics" className="-mx-1 flex gap-1 overflow-x-auto border-b pb-px">
      {LINKS.map(([href, label]) => {
        const active = href === "/analytics" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
