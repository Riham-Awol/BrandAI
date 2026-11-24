"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Check, Download, UserRoundCheck } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StructuredView } from "@/components/structured/structured-view";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { SectionPanel } from "@/components/studio/section-panel";
import { StudioShell, firstIncomplete } from "@/components/studio/studio-shell";
import { SECTION_SCHEMAS } from "../schemas.js";
import { LAUNCH_SECTIONS, PROFILE_STEP, SECTION_BY_KEY } from "../sections.js";
import { ChecklistView } from "./checklist-view";
import { ProfileStep } from "./profile-step";

const SPECS = Object.fromEntries(Object.entries(SECTION_SCHEMAS).map(([k, s]) => [k, schemaToSpec(s)]));
const STEPS = [...LAUNCH_SECTIONS, { ...PROFILE_STEP, icon: UserRoundCheck }];
const TITLES = Object.fromEntries(LAUNCH_SECTIONS.map((s) => [s.key, s.title]));

export function LaunchStudio({ workspaceId, initialProject, ai }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [project, setProject] = useState(initialProject);
  // Default step is chosen once on load, so generating a section doesn't move the user elsewhere.
  const [defaultStep] = useState(() => firstIncomplete(LAUNCH_SECTIONS, initialProject, "profile"));
  const requested = params.get("section");
  const current = STEPS.some((s) => s.key === requested) ? requested : defaultStep;
  const base = `/api/v1/workspaces/${workspaceId}/launch-projects/${project.id}`;

  const refresh = useCallback(async () => setProject(await apiRequest(base)), [base]);
  const select = (key) => router.replace(`${pathname}?section=${key}`, { scroll: false });
  const next = () => {
    const idx = STEPS.findIndex((s) => s.key === current);
    if (STEPS[idx + 1]) select(STEPS[idx + 1].key);
  };

  return (
    <StudioShell
      eyebrow="Business Launch Studio"
      title={project.business.name}
      subtitle={project.input.idea}
      ai={ai}
      steps={STEPS}
      sectionStates={project.sections}
      current={current}
      onSelect={select}
      actions={
        <>
          <Button variant="outline" asChild>
            <a href={`${base}/export`} download><Download /> Export</a>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/businesses/${project.business.id}`}>Profile</Link>
          </Button>
        </>
      }
    >
      {current === "profile" ? (
        <ProfileStep workspaceId={workspaceId} projectBase={base} businessId={project.business.id} />
      ) : (
        <SectionPanel
          key={current}
          section={SECTION_BY_KEY[current]}
          spec={SPECS[current]}
          state={project.sections[current]}
          project={project}
          base={base}
          ai={ai}
          sectionTitles={TITLES}
          onChanged={refresh}
          onNext={next}
          renderView={({ output, viewing, readOnly, setError }) => (
            <>
              {current === "idea_analysis" && <ScoreBanner content={output.content} />}
              {current === "launch_checklist" ? (
                <ChecklistView key={output.id} output={output} endpoint={`${base}/checklist`} canEdit={!readOnly && !viewing} onError={setError} />
              ) : (
                <StructuredView
                  spec={current === "idea_analysis" ? { ...SPECS[current], fields: SPECS[current].fields.filter((f) => !["viabilityScore", "verdict", "summary"].includes(f.key)) } : SPECS[current]}
                  value={output.content}
                  renderItemActions={
                    current === "names" && project.permissions.canEdit
                      ? (path, item) => path[0] === "suggestions" && <UseNameButton name={item.name} project={project} onDone={refresh} onError={setError} />
                      : undefined
                  }
                />
              )}
            </>
          )}
        />
      )}
    </StudioShell>
  );
}

function ScoreBanner({ content }) {
  const score = Math.max(0, Math.min(100, Math.round(content.viabilityScore)));
  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-background/60 p-5 sm:flex-row sm:items-center">
      <div
        className="grid size-24 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--highlight) ${score * 3.6}deg, var(--muted) 0deg)` }}
        role="img"
        aria-label={`Viability score ${score} out of 100`}
      >
        <div className="grid size-[76px] place-items-center rounded-full bg-card">
          <span className="font-display text-2xl font-semibold">{score}</span>
        </div>
      </div>
      <div className="space-y-2">
        <Badge variant={["strong", "promising"].includes(content.verdict) ? "success" : "warning"} className="capitalize">{content.verdict.replace("_", " ")}</Badge>
        <p className="text-[15px] leading-relaxed">{content.summary}</p>
      </div>
    </div>
  );
}

function UseNameButton({ name, project, onDone, onError }) {
  const [saving, setSaving] = useState(false);
  if (project.business.name === name) return <Badge variant="success"><Check className="size-3" /> Current name</Badge>;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={saving}
      onClick={async () => {
        setSaving(true);
        try {
          await apiRequest(`/api/v1/workspaces/${project.workspaceId}/businesses/${project.business.id}`, { method: "PATCH", body: { name } });
          await onDone();
        } catch (e) {
          onError(e.message);
        } finally {
          setSaving(false);
        }
      }}
    >
      Use this name
    </Button>
  );
}
