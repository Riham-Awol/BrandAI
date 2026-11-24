"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { StructuredEditor } from "@/components/structured/structured-editor";
import { StructuredView } from "@/components/structured/structured-view";
import { GeneratingState } from "./generating-state";

/**
 * One studio section: generate, view (custom or generic), versions, accept,
 * edit (schema-driven, server-validated) and regenerate with instructions.
 *
 * `renderView({ output, viewing, readOnly, setError, setNotice, refresh })` customizes display.
 * `keepStateOnEdit` re-sends the current state (e.g. a selection) with edits.
 */
export function SectionPanel({ section, spec, state, project, base, ai, sectionTitles, onChanged, onNext, renderView, keepStateOnEdit = false }) {
  const [viewing, setViewing] = useState(null);
  const [mode, setMode] = useState("view");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [draft, setDraft] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState(null);

  const output = viewing ?? state.active;
  const { canEdit, canGenerate } = project.permissions;
  const canRunAi = canGenerate && ai.configured;
  const missingInputs = useMemo(() => (section.uses ?? []).filter((k) => !project.sections[k]?.active).map((k) => sectionTitles[k]), [section, project, sectionTitles]);

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
      const body = { content: draft, ...(keepStateOnEdit && output?.state ? { state: output.state } : {}) };
      await apiRequest(`${base}/sections/${section.key}`, { method: "PUT", body });
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
      setNotice("Accepted. Later sections will use this version.");
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

      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert variant="success"><CheckCircle2 /><AlertDescription>{notice}</AlertDescription></Alert>}
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
              <Textarea id="feedback" rows={3} maxLength={1000} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="e.g. Make it feel more premium and less playful." />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMode("view")}>Cancel</Button>
                <Button size="sm" onClick={() => generate(true)}><Sparkles /> Regenerate</Button>
              </div>
              <p className="text-xs text-muted-foreground">A new version is created; earlier versions stay available.</p>
            </div>
          )}
          {renderView ? (
            renderView({ output, viewing, readOnly: !canEdit || Boolean(viewing), setError, setNotice, refresh: onChanged })
          ) : (
            <StructuredView spec={spec} value={output.content} />
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
      {missingInputs.length > 0 && <p className="mt-3 max-w-md text-xs text-muted-foreground">Tip: results improve if you generate {missingInputs.join(", ")} first.</p>}
      {canRunAi ? (
        <Button className="mt-6" onClick={onGenerate}><Sparkles /> Generate</Button>
      ) : (
        <p className="mt-6 text-sm font-medium text-muted-foreground">{canGenerate ? "AI generation is not configured yet." : "You have view-only access to this workspace."}</p>
      )}
    </div>
  );
}
