"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { switchWorkspaceAction } from "@/server/actions/workspace-actions.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function WorkspaceSwitcher({ workspaces, activeId }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  if (!active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left shadow-soft outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary font-display text-sm font-semibold text-secondary-foreground">
          {active.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{active.name}</span>
          <span className="block text-xs capitalize text-muted-foreground">{active.type.toLowerCase()} · {active.role.toLowerCase()}</span>
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-60">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() =>
              startTransition(async () => {
                await switchWorkspaceAction(w.id);
                router.refresh();
              })
            }
          >
            <span className="flex-1 truncate">{w.name}</span>
            {w.id === active.id && <Check className="!text-foreground" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
