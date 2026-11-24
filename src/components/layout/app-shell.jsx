import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function AppShell({ user, workspaces, activeWorkspace, children }) {
  const switcher = <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspace?.id} />;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr] print:block">
      <div className="hidden border-r border-sidebar-border bg-sidebar lg:block print:hidden">
        <aside className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto px-4 py-5">
          <Logo href="/dashboard" className="px-1" />
          {switcher}
          <SidebarNav />
        </aside>
      </div>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 print:hidden items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-10">
          <MobileNav switcher={switcher} />
          <Logo href="/dashboard" compact className="lg:hidden" />
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
