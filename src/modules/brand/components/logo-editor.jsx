"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { humanize } from "@/lib/humanize";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FONTS, FONT_BY_KEY } from "../catalog/fonts.js";
import { ICON_GROUPS } from "../catalog/icons.js";
import { normalizeHex } from "../color.js";
import { LETTER_CASES, MARK_SHAPES, MARK_TYPES } from "../schemas.js";

function svgDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Refines one logo concept with a live, server-rendered preview.
 * Saving creates a new version of the logo section with this concept selected.
 */
export function LogoEditor({ base, output, index, onSaved, onCancel }) {
  const [concept, setConcept] = useState(() => structuredClone(output.content.concepts[index]));
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setConcept((c) => ({ ...c, [key]: value }));
  const setColor = (key, value) => setConcept((c) => ({ ...c, colors: { ...c.colors, [key]: value } }));
  const colorsValid = Object.values(concept.colors).every((v) => normalizeHex(v));

  useEffect(() => {
    if (!colorsValid) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const [horizontal, mark] = await Promise.all(
          ["horizontal", "mark"].map((variant) =>
            apiRequest(`${base}/logo-preview`, { method: "POST", body: { concept, variant, theme: "color" }, signal: controller.signal }),
          ),
        );
        setPreviews({ horizontal: horizontal.svg, mark: mark.svg, warnings: horizontal.warnings });
        setError(null);
      } catch (e) {
        if (e.name !== "AbortError" && e.code !== "NETWORK_ERROR") setError(e.message);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [concept, base, colorsValid]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const content = structuredClone(output.content);
      content.concepts[index] = concept;
      await apiRequest(`${base}/sections/logo_concepts`, { method: "PUT", body: { content, state: { selected: index } } });
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const weights = FONT_BY_KEY[concept.fontKey]?.weights ?? [400];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4 lg:order-2">
        <div className="relative grid place-items-center h-44 rounded-xl border bg-white p-4">
          {previews.horizontal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={svgDataUri(previews.horizontal)} alt="Logo preview" className="absolute inset-0 h-full w-full object-contain p-3" />
          ) : (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="relative grid place-items-center h-28 rounded-xl border bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previews.mark && <img src={svgDataUri(previews.mark)} alt="Mark preview" className="absolute inset-0 h-full w-full object-contain p-3" />}
        </div>
        {previews.warnings?.length > 0 && <p className="text-xs text-warning">{previews.warnings.join(" ")}</p>}
      </div>

      <div className="space-y-5 lg:order-1">
        {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mark style" id="le-mark">
            <NativeSelect id="le-mark" value={concept.markType} onChange={(e) => set("markType", e.target.value)}>
              {MARK_TYPES.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Shape" id="le-shape">
            <NativeSelect id="le-shape" value={concept.shape} onChange={(e) => set("shape", e.target.value)}>
              {MARK_SHAPES.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
            </NativeSelect>
          </Field>
          {concept.markType === "icon" && (
            <Field label="Icon" id="le-icon">
              <NativeSelect id="le-icon" value={concept.icon} onChange={(e) => set("icon", e.target.value)}>
                {Object.entries(ICON_GROUPS).map(([group, names]) => (
                  <optgroup key={group} label={group}>
                    {names.map((n) => <option key={n} value={n}>{humanize(n)}</option>)}
                  </optgroup>
                ))}
              </NativeSelect>
            </Field>
          )}
          {concept.markType === "monogram" && (
            <Field label="Monogram letters" id="le-mono">
              <Input id="le-mono" maxLength={2} value={concept.monogram} onChange={(e) => set("monogram", e.target.value)} />
            </Field>
          )}
          <Field label="Font" id="le-font">
            <NativeSelect
              id="le-font"
              value={concept.fontKey}
              onChange={(e) => {
                const f = FONT_BY_KEY[e.target.value];
                setConcept((c) => ({ ...c, fontKey: f.key, fontWeight: String(f.weights.includes(Number(c.fontWeight)) ? c.fontWeight : f.weights.at(-1)) }));
              }}
            >
              {FONTS.map((f) => <option key={f.key} value={f.key}>{f.family} ({f.category})</option>)}
            </NativeSelect>
          </Field>
          <Field label="Weight" id="le-weight">
            <NativeSelect id="le-weight" value={concept.fontWeight} onChange={(e) => set("fontWeight", e.target.value)}>
              {weights.map((w) => <option key={w} value={String(w)}>{w}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Letter case" id="le-case">
            <NativeSelect id="le-case" value={concept.letterCase} onChange={(e) => set("letterCase", e.target.value)}>
              {LETTER_CASES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={`Letter spacing (${concept.letterSpacing.toFixed(2)} em)`} id="le-spacing">
            <input id="le-spacing" type="range" min={-0.05} max={0.3} step={0.01} value={concept.letterSpacing} onChange={(e) => set("letterSpacing", Number(e.target.value))} className="accent-primary" />
          </Field>
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">Colours</legend>
          {[["mark", "Mark"], ["markForeground", "Inside mark"], ["text", "Name"]].map(([key, label]) => (
            <Field key={key} label={label} id={`le-c-${key}`}>
              <div className="flex gap-2">
                <input type="color" aria-label={`${label} colour picker`} value={normalizeHex(concept.colors[key]) ?? "#000000"} onChange={(e) => setColor(key, e.target.value)} className="h-10 w-11 cursor-pointer rounded-lg border bg-card p-1" />
                <Input id={`le-c-${key}`} className="font-mono" value={concept.colors[key]} onChange={(e) => setColor(key, e.target.value)} aria-invalid={!normalizeHex(concept.colors[key]) || undefined} />
              </div>
            </Field>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" onClick={onCancel}><X /> Cancel</Button>
          <Button onClick={save} disabled={saving || !colorsValid}>{saving ? <Loader2 className="animate-spin" /> : <Check />} Save logo</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, id, children }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
