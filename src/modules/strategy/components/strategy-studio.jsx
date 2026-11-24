"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { StructuredView } from "@/components/structured/structured-view";
import { SectionPanel } from "@/components/studio/section-panel";
import { StudioShell, firstIncomplete } from "@/components/studio/studio-shell";
import { GOAL_LABELS, SECTION_SCHEMAS } from "../schemas.js";
import { PLAN_STEP, STRATEGY_SECTIONS, STRATEGY_SECTION_BY_KEY } from "../sections.js";
import { BudgetView } from "./budget-view";
import { PersonaCards } from "./persona-cards";
import { PlanReview } from "./plan-review";

const SPECS = Object.fromEntries(Object.entries(SECTION_SCHEMAS).map(([k, s]) => [k, schemaToSpec(s)]));
const STEPS = [...STRATEGY_SECTIONS, { ...PLAN_STEP, icon: ShieldCheck }];
const TITLES = Object.fromEntries(STRATEGY_SECTIONS.map((s) => [s.key, s.title]));

export function StrategyStudio({ workspaceId, initialProject, ai }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [project, setProject] = useState(initialProject);
  const [defaultStep] = useState(() => firstIncomplete(STRATEGY_SECTIONS, initialProject, "plan"));
  const requested = params.get("section");
  const current = STEPS.some((s) => s.key === requested) ? requested : defaultStep;
  const base = `/api/v1/workspaces/${workspaceId}/strategy-projects/${project.id}`;
  const refresh = useCallback(async () => setProject(await apiRequest(base)), [base]);
  const select = (key) => router.replace(`${pathname}?section=${key}`, { scroll: false });
  const next = () => {
    const idx = STEPS.findIndex((s) => s.key === current);
    if (STEPS[idx + 1]) select(STEPS[idx + 1].key);
  };
  const i = project.input;

  return (
    <StudioShell
      eyebrow="Marketing Strategy Studio"
      title={project.business.name}
      subtitle={`${GOAL_LABELS[i.primaryGoal]} · ${i.timeframeMonths} months · ${i.monthlyBudget != null ? `${i.monthlyBudget} ${i.currency}/month` : `budget to suggest (${i.currency})`}`}
      ai={ai}
      steps={STEPS}
      sectionStates={project.sections}
      current={current}
      onSelect={select}
      actions={
        <>
          <Button variant="outline" asChild><a href={`${base}/export?format=markdown`} download><Download /> Export</a></Button>
          <Button variant="outline" asChild><Link href={`/businesses/${project.business.id}/marketing`}>Approved plan</Link></Button>
        </>
      }
    >
      {current === "plan" ? (
        <PlanReview base={base} project={project} />
      ) : (
        <SectionPanel
          key={current}
          section={STRATEGY_SECTION_BY_KEY[current]}
          spec={SPECS[current]}
          state={project.sections[current]}
          project={project}
          base={base}
          ai={ai}
          sectionTitles={TITLES}
          onChanged={refresh}
          onNext={next}
          renderView={({ output }) =>
            current === "personas" ? (
              <PersonaCards personas={output.content.personas} />
            ) : current === "budget" ? (
              <BudgetView content={output.content} statedMonthly={i.monthlyBudget} spec={SPECS.budget} />
            ) : (
              <StructuredView spec={SPECS[current]} value={output.content} />
            )
          }
        />
      )}
    </StudioShell>
  );
}
