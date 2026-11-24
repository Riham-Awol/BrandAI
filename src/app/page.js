import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { PRODUCT_PHASES } from "@/lib/roadmap";

export default function HomePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -top-56 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-highlight/25 blur-3xl" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
          <Button asChild className="hidden sm:inline-flex"><Link href="/register">Get started</Link></Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <section className="mx-auto max-w-3xl py-20 text-center sm:py-28">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
            <span className="size-1.5 rounded-full bg-highlight" /> Early access — building in public
          </p>
          <h1 className="text-[40px] leading-[1.05] font-semibold sm:text-6xl">
            Your Business. Your Brand. <span className="italic text-highlight">Your AI Marketing Team.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Describe your business once. Brand AI turns that approved context into consistent strategy, branding, content and designs.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild><Link href="/register">Create your workspace <ArrowRight /></Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/login">Sign in</Link></Button>
          </div>
        </section>

        <section aria-labelledby="roadmap-heading" className="pb-24">
          <h2 id="roadmap-heading" className="mb-2 text-center text-2xl font-semibold sm:text-3xl">One connected platform, ten studios</h2>
          <p className="mb-10 text-center text-muted-foreground">Released phase by phase. Each studio reuses the same approved business context.</p>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PRODUCT_PHASES.map((p) => (
              <li key={p.key} className="rounded-xl border bg-card p-4 shadow-soft">
                <p className="text-xs font-semibold text-muted-foreground">Phase {p.phase}</p>
                <p className="mt-1 font-semibold leading-snug">{p.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.summary}</p>
              </li>
            ))}
          </ol>
          <ul className="mx-auto mt-12 grid max-w-3xl gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            {["Workspace-level data isolation", "You approve what AI can reuse", "Built for teams and agencies"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-highlight" />{t}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
