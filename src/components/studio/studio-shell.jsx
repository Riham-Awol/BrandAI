"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Shared layout for AI studios: header, AI availability banners, progress and
 * a step list (vertical on desktop, horizontal scroll on mobile).
 */
export function StudioShell({ eyebrow, title, subtitle, actions, ai, steps, sectionStates, current, onSelect, children }) {
  const generated = steps.filter((s) => sectionStates[s.key]?.active).length;
  const countable = steps.filter((s) => sectionStates[s.key] !== undefined).length;
  const activeStepRef = useRef(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) activeStepRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
          <h1 className="text-3xl font-semibold">{title}</h1>
          {subtitle && <p className="max-w-2xl text-sm text-muted-foreground line-clamp-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </header>

      {!ai.configured && (
        <Alert variant="info">
          <AlertCircle />
          <AlertTitle>AI generation is not available on this server yet</AlertTitle>
          <AlertDescription>An administrator needs to configure the AI provider (ANTHROPIC_API_KEY). You can still review and edit existing results.</AlertDescription>
        </Alert>
      )}
      {ai.isMock && (
        <Alert variant="info">
          <AlertCircle />
          <AlertTitle>Test mode</AlertTitle>
          <AlertDescription>The mock AI provider is active. Results are sample data for testing, not real analysis.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">{generated} of {countable} sections ready</span>
          <span className="text-muted-foreground">{Math.round((generated / Math.max(1, countable)) * 100)}%</span>
        </div>
        <Progress value={(generated / Math.max(1, countable)) * 100} label="Progress" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Sections" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ol className="flex gap-2 lg:sticky lg:top-24 lg:flex-col lg:gap-0.5">
            {steps.map((step, i) => {
              const state = sectionStates[step.key];
              const active = step.key === current;
              return (
                <li key={step.key} className="shrink-0">
                  <button
                    type="button"
                    ref={active ? activeStepRef : undefined}
                    onClick={() => onSelect(step.key)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      "max-lg:border max-lg:bg-card",
                    )}
                  >
                    <StepDot index={i + 1} state={state} icon={step.icon} />
                    <span className="whitespace-nowrap lg:whitespace-normal">
                      <span className="lg:hidden">{step.short}</span>
                      <span className="hidden lg:inline">{step.title}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function StepDot({ index, state, icon: Icon }) {
  if (state?.active?.isAccepted) {
    return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-[11px] text-white" aria-label="Accepted"><Check className="size-3.5" /></span>;
  }
  if (state?.active) {
    return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-highlight text-[11px] font-semibold text-[#17151c]" aria-label="Generated">{index}</span>;
  }
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold" aria-label={Icon ? "Final step" : "Not started"}>
      {Icon ? <Icon className="size-3.5" /> : index}
    </span>
  );
}

export function firstIncomplete(sections, project, fallback) {
  return sections.find((s) => !project.sections[s.key].active)?.key ?? fallback;
}
