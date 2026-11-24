import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between dark:bg-[#1d1527] dark:text-[#f2eef7]">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-32 size-[520px] rounded-full bg-[#b9a0d2]/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-24 size-[460px] rounded-full bg-[#e8ddf4]/15 blur-3xl" />
        <Logo className="relative [&>span:first-child]:bg-[#f7f4fa] [&>span:first-child]:text-[#302442]" />
        <div className="relative max-w-md space-y-6">
          <p className="font-display text-4xl leading-[1.1] font-medium">Your Business. Your Brand. Your AI Marketing Team.</p>
          <p className="text-[15px] leading-relaxed opacity-80">
            Describe your business once. Brand AI keeps that approved context and reuses it for every strategy, design and
            campaign you create.
          </p>
        </div>
        <p className="relative text-xs opacity-60">© {2026} Brand AI</p>
      </aside>
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
