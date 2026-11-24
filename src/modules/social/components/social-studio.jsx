"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Megaphone } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { StructuredView } from "@/components/structured/structured-view";
import { SectionPanel } from "@/components/studio/section-panel";
import { StudioShell, firstIncomplete } from "@/components/studio/studio-shell";
import { PLATFORMS } from "../platforms.js";
import { SECTION_SCHEMAS } from "../schemas.js";
import { POSTS_STEP, SOCIAL_SECTIONS, SOCIAL_SECTION_BY_KEY } from "../sections.js";
import { CalendarView } from "./calendar-view";
import { PostsBoard } from "./posts-board";

const SPECS = Object.fromEntries(Object.entries(SECTION_SCHEMAS).map(([k, s]) => [k, schemaToSpec(s)]));
const STEPS = [...SOCIAL_SECTIONS, { ...POSTS_STEP, icon: Megaphone }];
const TITLES = Object.fromEntries(SOCIAL_SECTIONS.map((s) => [s.key, s.title]));

export function SocialStudio({ workspaceId, initialProject, ai }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [project, setProject] = useState(initialProject);
  const [defaultStep] = useState(() => firstIncomplete(SOCIAL_SECTIONS, initialProject, "posts"));
  const requested = params.get("section");
  const current = STEPS.some((s) => s.key === requested) ? requested : defaultStep;
  const base = `/api/v1/workspaces/${workspaceId}/social-projects/${project.id}`;
  const refresh = useCallback(async () => setProject(await apiRequest(base)), [base]);
  const select = (key) => router.replace(`${pathname}?section=${key}`, { scroll: false });
  const next = () => {
    const idx = STEPS.findIndex((s) => s.key === current);
    if (STEPS[idx + 1]) select(STEPS[idx + 1].key);
  };
  const i = project.input;
  const monthLabel = new Date(`${i.month}-01T12:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <StudioShell
      eyebrow="Social Media Studio"
      title={project.business.name}
      subtitle={`${monthLabel} · ${i.platforms.map((p) => PLATFORMS[p].label).join(", ")} · ${i.postsPerWeek} posts/week`}
      ai={ai}
      steps={STEPS}
      sectionStates={project.sections}
      current={current}
      onSelect={select}
    >
      {current === "posts" ? (
        <PostsBoard base={base} project={project} ai={ai} hasCalendar={Boolean(project.sections.calendar.active)} />
      ) : (
        <SectionPanel
          key={current}
          section={SOCIAL_SECTION_BY_KEY[current]}
          spec={SPECS[current]}
          state={project.sections[current]}
          project={project}
          base={base}
          ai={ai}
          sectionTitles={TITLES}
          onChanged={refresh}
          onNext={next}
          renderView={({ output }) =>
            current === "calendar" ? (
              <div className="space-y-5">
                <CalendarView month={i.month} entries={output.content.entries} />
                {output.content.notes && <p className="rounded-xl border bg-background/60 p-4 text-sm">{output.content.notes}</p>}
              </div>
            ) : (
              <StructuredView spec={SPECS[current]} value={output.content} />
            )
          }
        />
      )}
    </StudioShell>
  );
}
