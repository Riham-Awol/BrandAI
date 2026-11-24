"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { BookOpen, Printer } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { StructuredView } from "@/components/structured/structured-view";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { SectionPanel } from "@/components/studio/section-panel";
import { StudioShell, firstIncomplete } from "@/components/studio/studio-shell";
import { PROFILE_SCHEMAS } from "../profile-schemas.js";
import { PROFILE_PRINT_STEP, PROFILE_SECTIONS, PROFILE_SECTION_BY_KEY } from "../profile-sections.js";
import { ProfileBrochure } from "./profile-brochure";

const SPECS = Object.fromEntries(Object.entries(PROFILE_SCHEMAS).map(([k, s]) => [k, schemaToSpec(s)]));
const STEPS = [...PROFILE_SECTIONS, { ...PROFILE_PRINT_STEP, icon: BookOpen }];
const TITLES = Object.fromEntries(PROFILE_SECTIONS.map((s) => [s.key, s.title]));

export function ProfileStudio({ workspaceId, initialProject, ai, brand, details }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [project, setProject] = useState(initialProject);
  const [defaultStep] = useState(() => firstIncomplete(PROFILE_SECTIONS, initialProject, "brochure"));
  const requested = params.get("section");
  const current = STEPS.some((s) => s.key === requested) ? requested : defaultStep;
  const base = `/api/v1/workspaces/${workspaceId}/company-profiles/${project.id}`;
  const refresh = useCallback(async () => setProject(await apiRequest(base)), [base]);
  const select = (key) => router.replace(`${pathname}?section=${key}`, { scroll: false });
  const next = () => {
    const idx = STEPS.findIndex((s) => s.key === current);
    if (STEPS[idx + 1]) select(STEPS[idx + 1].key);
  };
  const content = Object.fromEntries(PROFILE_SECTIONS.map((s) => [s.key, project.sections[s.key]?.active?.content ?? null]));
  const ready = Object.values(content).some(Boolean);

  return (
    <StudioShell
      eyebrow="Company profile"
      title={project.business.name}
      subtitle={project.input?.purpose ?? "A branded brochure about your business"}
      ai={ai}
      steps={STEPS}
      sectionStates={project.sections}
      current={current}
      onSelect={select}
      actions={<Button variant="outline" asChild><a href={`/print/profiles/${project.id}`} target="_blank" rel="noopener noreferrer"><Printer /> Print / PDF</a></Button>}
    >
      {current === "brochure" ? (
        ready ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Uses the accepted version of each section (or the latest). Check every statement before sharing — AI can be wrong about details.</p>
            <div className="rounded-xl bg-muted/50 p-3 sm:p-6"><ProfileBrochure content={content} brand={brand} details={details} /></div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Generate at least one section to see the brochure.</p>
        )
      ) : (
        <SectionPanel
          key={current}
          section={PROFILE_SECTION_BY_KEY[current]}
          spec={SPECS[current]}
          state={project.sections[current]}
          project={project}
          base={base}
          ai={ai}
          sectionTitles={TITLES}
          onChanged={refresh}
          onNext={next}
          renderView={({ output }) => <StructuredView spec={SPECS[current]} value={output.content} />}
        />
      )}
    </StudioShell>
  );
}
