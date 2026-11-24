"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, STUDIO_NAV } from "./nav-config";

export function SidebarNav({ onNavigate }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      <ul className="grid gap-1">
        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-[18px]" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div>
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">Studios</p>
        <ul className="grid gap-0.5">
          {STUDIO_NAV.map(({ key, label, icon: Icon, phase }) => (
            <li key={key}>
              <span
                aria-disabled="true"
                title={`Arrives in Phase ${phase}`}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/70"
              >
                <Icon className="size-[18px]" />
                <span className="flex-1 truncate">{label}</span>
                <Lock className="size-3.5 opacity-60" aria-label="Not yet available" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
