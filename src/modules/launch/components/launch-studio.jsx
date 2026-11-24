"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Download, Pencil, RefreshCw, Sparkles, UserRoundCheck, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { StructuredEditor } from "@/components/structured/structured-editor";
import { StructuredView } from "@/components/structured/structured-view";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { cn } from "@/lib/utils";
import { SECTION_SCHEMAS } from "../schemas.js";
import { LAUNCH_SECTIONS, PROFILE_STEP, SECTION_BY_KEY } from "../sections.js";
import { ChecklistView } from "./checklist-view";
import { GeneratingState } from "./generating-state";
import { ProfileStep } from "./profile-step";

const SPECS = Object.fromEntries(Object.entries(SECTION_SCHEMAS).map(([k, s]) => [k, schemaToSpec(s)]));
const STEPS = [...LAUNCH_SECTIONS, PROFILE_STEP];

export function LaunchStudio({ workspaceId, initialProject, ai }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [project, setProject] = useState(initialProject);
  // Default step is chosen once on load, so generating a section doesn't move the user elsewhere.
  const [defaultStep] = useState(() => firstIncomplete(initialProject));
  const requested = params.get("section");
  const current = STEPS.some((s) => s.key === requested) ? requested : defaultStep;
  const base = `/api/v1/workspaces/${workspaceId}/launch-projects/${project.id}`;
  const done = LAUNCH_SECTIONS.filter((s) => project.sections[s.key].active).length;

  const refresh = useCallback(async () => {
    setProject(await apiRequest(base));
  }, [base]);

  const select = (key) => router.replace(`${pathname}?section=${key}`, { scroll: false });

  // On small screens the step list scrolls horizontally: keep the active step visible.
  const activeStepRef = useRef(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      activeStepRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [current]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Business Launch Studio</p>
          <h1 className="text-3xl font-semibold">{project.business.name}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground line-clamp-2">{project.input.idea}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" asChild>
            <a href={`${base}/export`} download>
              <Download /> Export
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/businesses/${project.business.id}`}>Profile</Link>
          </Button>
        </div>
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
          <span className="font-medium">{done} of {LAUNCH_SECTIONS.length} sections ready</span>
          <span className="text-muted-foreground">{Math.round((done / LAUNCH_SECTIONS.length) * 100)}%</span>
        </div>
        <Progress value={(done / LAUNCH_SECTIONS.length) * 100} label="Launch plan progress" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Launch plan sections" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ol className="flex gap-2 lg:sticky lg:top-24 lg:flex-col lg:gap-0.5">
            {STEPS.map((step, i) => {
              const state = step.key === "profile" ? null : project.sections[step.key];
              const active = step.key === current;
              return (
                <li key={step.key} className="shrink-0">
                  <button
                    type="button"
                    ref={active ? activeStepRef : undefined}
                    onClick={() => select(step.key)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      "max-lg:border max-lg:bg-card",
                    )}
                  >
                    <StepDot index={i + 1} state={state} isProfile={step.key === "profile"} />
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

        <div className="min-w-0">
          {current === "profile" ? (
            <ProfileStep workspaceId={workspaceId} projectBase={base} businessId={project.business.id} />
          ) : (
            <SectionPanel
              key={current}
              section={SECTION_BY_KEY[current]}
              state={project.sections[current]}
              project={project}
              base={base}
              workspaceId={workspaceId}
              ai={ai}
              onChanged={refresh}
              onNext={() => {
                const idx = STEPS.findIndex((s) => s.key === current);
                if (STEPS[idx + 1]) select(STEPS[idx + 1].key);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function firstIncomplete(project) {
  return LAUNCH_SECTIONS.find((s) => !project.sections[s.key].active)?.key ?? "profile";
}

function StepDot({ index, state, isProfile }) {
  if (state?.active?.isAccepted) {
    return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-[11px] text-white" aria-label="Accepted"><Check className="size-3.5" /></span>;
  }
  if (state?.active) {
    return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-highlight text-[11px] font-semibold text-[#17151c]" aria-label="Generated">{index}</span>;
  }
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold" aria-label={isProfile ? "Final step" : "Not started"}>
      {isProfile ? <UserRoundCheck className="size-3.5" /> : index}
    </span>
  );
}

function SectionPanel({ section, state, project, base, ai, onChanged, onNext }) {
  const spec = SPECS[section.key];
  const [viewing, setViewing] = useState(null); // a non-active version being previewed
  const [mode, setMode] = useState("view"); // view | edit | regenerate
  const [busy, setBusy] = useState(null); // generate | save | accept
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [draft, setDraft] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState(null);

  const output = viewing ?? state.active;
  const { canEdit, canGenerate } = project.permissions;
  const canRunAi = canGenerate && ai.configured;
  const missingInputs = useMemo(() => section.uses.filter((k) => !project.sections[k].active).map((k) => SECTION_BY_KEY[k].title), [section, project]);

  async function run(kind, fn) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      if (e.code === "VALIDATION_ERROR" && e.details) setFieldErrors(e.details);
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const generate = (withFeedback) =>
    run("generate", async () => {
      await apiRequest(`${base}/sections/${section.key}/generate`, { method: "POST", body: withFeedback && feedback.trim() ? { feedback: feedback.trim() } : {} });
      setViewing(null);
      setMode("view");
      setFeedback("");
      await onChanged();
    });

  const save = () =>
    run("save", async () => {
      setFieldErrors({});
      await apiRequest(`${base}/sections/${section.key}`, { method: "PUT", body: { content: draft } });
      setViewing(null);
      setMode("view");
      await onChanged();
      setNotice("Your edits were saved as a new version.");
    });

  const accept = () =>
    run("accept", async () => {
      await apiRequest(`${base}/sections/${section.key}/accept`, { method: "POST", body: { outputId: output.id } });
      setViewing(null);
      await onChanged();
      setNotice("Accepted. Later sections and your business profile will use this version.");
    });

  const pickVersion = (id) =>
    run("load", async () => {
      if (id === state.active.id) setViewing(null);
      else setViewing(await apiRequest(`${base}/sections/${section.key}/versions/${id}`));
      setMode("view");
    });

  return (
    <Card className="gap-6 p-5 sm:p-7">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{section.title}</h2>
          <p className="text-sm text-muted-foreground">{section.description}</p>
        </div>
        {output && mode === "view" && busy !== "generate" && (
          <div className="flex flex-wrap items-center gap-2">
            {state.versions.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="sr-only">Version</span>
                <NativeSelect className="h-8 w-auto text-xs" value={output.id} onChange={(e) => pickVersion(e.target.value)}>
                  {state.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} · {v.source === "EDIT" ? "edited" : "AI"}{v.isAccepted ? " · accepted" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )}
            {output.isAccepted ? (
              <Badge variant="success"><CheckCircle2 className="size-3" /> Accepted</Badge>
            ) : (
              canEdit && (
                <Button size="sm" onClick={accept} disabled={busy === "accept"}>
                  <Check /> Accept{viewing ? " this version" : ""}
                </Button>
              )
            )}
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => { setDraft(structuredClone(output.content)); setFieldErrors({}); setMode("edit"); }}>
                <Pencil /> Edit
              </Button>
            )}
            {canRunAi && (
              <Button size="sm" variant="outline" onClick={() => setMode("regenerate")}>
                <RefreshCw /> Regenerate
              </Button>
            )}
          </div>
        )}
      </header>

      {error && (
        <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {notice && (
        <Alert variant="success"><CheckCircle2 /><AlertDescription>{notice}</AlertDescription></Alert>
      )}
      {viewing && (
        <Alert variant="info"><AlertCircle /><AlertDescription>You are viewing an older version (v{viewing.version}). Accept it to make it the version used by later sections.</AlertDescription></Alert>
      )}
      {output?.isMock && <Badge variant="warning" className="w-fit">Sample data from the mock AI provider</Badge>}

      {busy === "generate" ? (
        <GeneratingState title={section.title} />
      ) : !output ? (
        <EmptySection section={section} missingInputs={missingInputs} canRunAi={canRunAi} canGenerate={canGenerate} onGenerate={() => generate(false)} />
      ) : mode === "edit" ? (
        <div className="space-y-6">
          <StructuredEditor spec={spec} value={draft} onChange={setDraft} errors={fieldErrors} />
          <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t bg-card/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7">
            <Button variant="ghost" onClick={() => setMode("view")}><X /> Cancel</Button>
            <Button onClick={save} disabled={busy === "save"}><Check /> Save as new version</Button>
          </div>
        </div>
      ) : (
        <>
          {mode === "regenerate" && (
            <div className="space-y-3 rounded-xl border border-highlight/40 bg-accent/40 p-4">
              <label htmlFor="feedback" className="text-sm font-semibold">What should change? (optional)</label>
              <Textarea id="feedback" rows={3} maxLength={1000} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="e.g. Focus more on online sales, and make the tone more premium." />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMode("view")}>Cancel</Button>
                <Button size="sm" onClick={() => generate(true)}><Sparkles /> Regenerate</Button>
              </div>
              <p className="text-xs text-muted-foreground">A new version is created; earlier versions stay available.</p>
            </div>
          )}
          {section.key === "idea_analysis" && <ScoreBanner content={output.content} />}
          {section.key === "launch_checklist" ? (
            <ChecklistView key={output.id} output={output} endpoint={`${base}/checklist`} canEdit={canEdit && !viewing} onError={setError} />
          ) : (
            <StructuredView
              spec={section.key === "idea_analysis" ? { ...spec, fields: spec.fields.filter((f) => !["viabilityScore", "verdict", "summary"].includes(f.key)) } : spec}
              value={output.content}
              renderItemActions={
                section.key === "names" && canEdit
                  ? (path, item) => path[0] === "suggestions" && <UseNameButton name={item.name} project={project} onDone={onChanged} onError={setError} />
                  : undefined
              }
            />
          )}
          <footer className="flex justify-end border-t pt-5">
            <Button variant="ghost" onClick={onNext}>Next step →</Button>
          </footer>
        </>
      )}
    </Card>
  );
}

function EmptySection({ section, missingInputs, canRunAi, canGenerate, onGenerate }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-background/50 px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Sparkles className="size-5" /></span>
      <h3 className="text-lg font-semibold">Generate your {section.title.toLowerCase()}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{section.description}</p>
      {missingInputs.length > 0 && (
        <p className="mt-3 max-w-md text-xs text-muted-foreground">Tip: results improve if you generate {missingInputs.join(", ")} first.</p>
      )}
      {canRunAi ? (
        <Button className="mt-6" onClick={onGenerate}><Sparkles /> Generate</Button>
      ) : (
        <p className="mt-6 text-sm font-medium text-muted-foreground">{canGenerate ? "AI generation is not configured yet." : "You have view-only access to this workspace."}</p>
      )}
    </div>
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
  const isCurrent = project.business.name === name;
  if (isCurrent) return <Badge variant="success"><Check className="size-3" /> Current name</Badge>;
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
