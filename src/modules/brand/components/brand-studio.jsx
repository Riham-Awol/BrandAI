"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Paintbrush, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { StructuredView } from "@/components/structured/structured-view";
import { SectionPanel } from "@/components/studio/section-panel";
import { StudioShell, firstIncomplete } from "@/components/studio/studio-shell";
import { SECTION_SCHEMAS, SELECTABLE } from "../schemas.js";
import { BRAND_SECTIONS, BRAND_SECTION_BY_KEY, IDENTITY_STEP } from "../sections.js";
import { LogoConceptCard, PaletteCard, SelectableList, TaglineCard, TypographyCard } from "./brand-views";
import { LogoEditor } from "./logo-editor";
import { LogoVariants } from "./logo-variants";
import { IdentityReview } from "./identity-review";

const SPECS = Object.fromEntries(Object.entries(SECTION_SCHEMAS).map(([k, s]) => [k, schemaToSpec(s)]));
const STEPS = [...BRAND_SECTIONS, { ...IDENTITY_STEP, icon: ShieldCheck }];
const TITLES = Object.fromEntries(BRAND_SECTIONS.map((s) => [s.key, s.title]));

export function BrandStudio({ workspaceId, initialProject, ai }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [project, setProject] = useState(initialProject);
  const [defaultStep] = useState(() => firstIncomplete(BRAND_SECTIONS, initialProject, "identity"));
  const requested = params.get("section");
  const current = STEPS.some((s) => s.key === requested) ? requested : defaultStep;
  const base = `/api/v1/workspaces/${workspaceId}/brand-projects/${project.id}`;

  const refresh = useCallback(async () => setProject(await apiRequest(base)), [base]);
  const select = (key) => router.replace(`${pathname}?section=${key}`, { scroll: false });
  const next = () => {
    const idx = STEPS.findIndex((s) => s.key === current);
    if (STEPS[idx + 1]) select(STEPS[idx + 1].key);
  };

  const logoOutput = project.sections.logo_concepts.active;
  const selectedLogoSrc = logoOutput ? `${base}/logo/${logoOutput.id}/${logoOutput.state?.selected ?? 0}?variant=horizontal&theme=color&height=160` : null;

  return (
    <StudioShell
      eyebrow="Brand Identity Studio"
      title={project.business.name}
      subtitle={project.business.description}
      ai={ai}
      steps={STEPS}
      sectionStates={project.sections}
      current={current}
      onSelect={select}
      actions={
        <Button variant="outline" asChild>
          <Link href={`/businesses/${project.business.id}/brand`}>Brand hub</Link>
        </Button>
      }
    >
      {current === "identity" ? (
        <IdentityReview base={base} project={project} logoSrc={selectedLogoSrc} />
      ) : (
        <SectionPanel
          key={current}
          section={BRAND_SECTION_BY_KEY[current]}
          spec={SPECS[current]}
          state={project.sections[current]}
          project={project}
          base={base}
          ai={ai}
          sectionTitles={TITLES}
          onChanged={refresh}
          onNext={next}
          keepStateOnEdit={Boolean(SELECTABLE[current])}
          renderView={(ctx) => <SectionView section={current} base={base} project={project} refresh={refresh} {...ctx} />}
        />
      )}
    </StudioShell>
  );
}

function SectionView({ section, output, readOnly, setError, base, project, refresh }) {
  const [editing, setEditing] = useState(false);
  const stateEndpoint = `${base}/sections/${section}/state`;
  const common = { output, endpoint: stateEndpoint, readOnly, onSaved: refresh, onError: setError, recommendation: output.content.recommendation };

  if (section === "taglines") return <SelectableList {...common} items={output.content.taglines} renderItem={(item) => <TaglineCard item={item} />} />;
  if (section === "palettes") return <SelectableList {...common} items={output.content.palettes} renderItem={(item) => <PaletteCard item={item} />} />;
  if (section === "typography") {
    return <SelectableList {...common} items={output.content.pairings} renderItem={(item) => <TypographyCard item={item} sampleName={project.business.name} />} />;
  }
  if (section === "logo_concepts") {
    const selected = output.state?.selected ?? 0;
    const src = (i, variant = "horizontal", theme = "color") => `${base}/logo/${output.id}/${i}?variant=${variant}&theme=${theme}&height=160`;
    if (editing) {
      return (
        <LogoEditor
          base={base}
          output={output}
          index={selected}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await refresh();
          }}
        />
      );
    }
    return (
      <div className="space-y-8">
        <SelectableList {...common} items={output.content.concepts} renderItem={(item, i) => <LogoConceptCard item={item} src={src(i)} />} />
        <section className="space-y-4 border-t pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Variations of the selected logo</h3>
              <p className="text-sm text-muted-foreground">Every layout in colour, single-colour and inverse versions.</p>
            </div>
            {!readOnly && (
              <Button variant="outline" onClick={() => setEditing(true)}><Paintbrush /> Customize logo</Button>
            )}
          </div>
          <LogoVariants key={`${output.id}-${selected}`} srcFor={(variant, theme) => src(selected, variant, theme)} />
        </section>
      </div>
    );
  }
  return <StructuredView spec={SPECS[section]} value={output.content} />;
}
