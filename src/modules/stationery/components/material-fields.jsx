"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ARTWORKS, COLORWAYS, MATERIAL_KINDS, PLACEMENT_LABELS, PRODUCT_COLORS, TEMPLATE_LABELS } from "../catalog.js";

/** Shows an SVG through <img> (no script execution); keeps the physical aspect ratio. */
export function SvgPreview({ svg, label, className, busy, background }) {
  const src = useMemo(() => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null), [svg]);
  const ratio = useMemo(() => {
    const m = svg?.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    return m ? `${m[1]} / ${m[2]}` : "1 / 1";
  }, [svg]);
  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px]", busy && "opacity-70", className)} style={{ aspectRatio: ratio, ...(background ? { background } : {}) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG data URI */}
      {src ? <img src={src} alt={label} className="absolute inset-0 size-full object-contain" /> : <div className="absolute inset-0 animate-pulse bg-muted" />}
    </div>
  );
}

function Field({ id, label, children, hint, error }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

const options = (obj, keys = Object.keys(obj)) => keys.map((k) => <option key={k} value={k}>{obj[k]}</option>);

/** Edits only the fields that matter for the material kind. */
export function MaterialFields({ kind, spec, onChange, errors = {}, disabled }) {
  const k = MATERIAL_KINDS[kind];
  const has = (f) => k.fields.includes(f);
  const set = (key, value) => onChange({ ...spec, [key]: value });
  const setPerson = (key, value) => onChange({ ...spec, person: { ...spec.person, [key]: value } });
  const merch = k.group === "merch";
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <Field id="m-name" label="Name" error={errors.name?.[0]}>
        <Input id="m-name" value={spec.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {k.templates && (
          <Field id="m-template" label={kind === "PACKAGING" ? "Box size" : "Template"}>
            <NativeSelect id="m-template" value={spec.template} onChange={(e) => set("template", e.target.value)}>{options(TEMPLATE_LABELS, k.templates)}</NativeSelect>
          </Field>
        )}
        {!merch && (
          <Field id="m-colorway" label="Colours">
            <NativeSelect id="m-colorway" value={spec.colorway} onChange={(e) => set("colorway", e.target.value)}>{options(COLORWAYS)}</NativeSelect>
          </Field>
        )}
        {has("productColor") && (
          <Field id="m-product" label="Product colour">
            <NativeSelect id="m-product" value={spec.productColor} onChange={(e) => set("productColor", e.target.value)}>{options(PRODUCT_COLORS)}</NativeSelect>
          </Field>
        )}
        {has("artwork") && (
          <Field id="m-artwork" label="Artwork">
            <NativeSelect id="m-artwork" value={spec.artwork} onChange={(e) => set("artwork", e.target.value)}>{options(ARTWORKS)}</NativeSelect>
          </Field>
        )}
        {has("placement") && (
          <Field id="m-placement" label="Placement">
            <NativeSelect id="m-placement" value={spec.placement} onChange={(e) => set("placement", e.target.value)}>{options(PLACEMENT_LABELS, k.placements)}</NativeSelect>
          </Field>
        )}
      </div>
      {has("slogan") && (
        <Field id="m-slogan" label="Slogan" hint="Used by the slogan artworks (max 60 characters).">
          <Input id="m-slogan" value={spec.slogan} maxLength={60} onChange={(e) => set("slogan", e.target.value)} />
        </Field>
      )}
      {has("person") && (
        <div className="grid gap-4 rounded-lg border p-3 sm:grid-cols-2">
          <p className="text-sm font-medium sm:col-span-2">{kind === "UNIFORM" ? "Name on the uniform (optional)" : "Person on the card"}</p>
          <Field id="m-person-name" label="Name"><Input id="m-person-name" value={spec.person.name} maxLength={80} onChange={(e) => setPerson("name", e.target.value)} /></Field>
          <Field id="m-person-title" label="Job title"><Input id="m-person-title" value={spec.person.title} maxLength={80} onChange={(e) => setPerson("title", e.target.value)} /></Field>
          {kind === "BUSINESS_CARD" && (
            <>
              <Field id="m-person-phone" label="Phone"><Input id="m-person-phone" value={spec.person.phone} maxLength={40} onChange={(e) => setPerson("phone", e.target.value)} /></Field>
              <Field id="m-person-email" label="Email"><Input id="m-person-email" value={spec.person.email} maxLength={254} onChange={(e) => setPerson("email", e.target.value)} /></Field>
            </>
          )}
        </div>
      )}
      {has("showDetails") && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={spec.showDetails} onChange={(e) => set("showDetails", e.target.checked)} /> Show website and address</label>
      )}
      {has("showRegistration") && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={spec.showRegistration} onChange={(e) => set("showRegistration", e.target.checked)} /> Show company and tax numbers in the footer</label>
      )}
      {has("footerNote") && (
        <Field id="m-footer" label="Footer note (optional)"><Input id="m-footer" value={spec.footerNote} maxLength={160} onChange={(e) => set("footerNote", e.target.value)} /></Field>
      )}
      {has("productName") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="m-product-name" label="Product name"><Input id="m-product-name" value={spec.productName} maxLength={60} onChange={(e) => set("productName", e.target.value)} /></Field>
          <Field id="m-descriptor" label="Description line"><Input id="m-descriptor" value={spec.descriptor} maxLength={120} onChange={(e) => set("descriptor", e.target.value)} /></Field>
        </div>
      )}
      {has("tagline") && (
        <Field id="m-tagline" label="Tagline (optional)"><Input id="m-tagline" value={spec.tagline} maxLength={100} onChange={(e) => set("tagline", e.target.value)} /></Field>
      )}
      {has("backText") && (
        <Field id="m-back" label="Back of pack text"><Textarea id="m-back" rows={3} value={spec.backText} maxLength={600} onChange={(e) => set("backText", e.target.value)} /></Field>
      )}
      {has("details") && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Product facts</p>
          <p className="text-xs text-muted-foreground">Weight, ingredients, allergens, storage… You are responsible for label information required by law where you sell.</p>
          {spec.details.map((d, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Fact ${i + 1} label`} value={d.label} maxLength={30} placeholder="Net weight" className="w-36" onChange={(e) => set("details", spec.details.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)))} />
              <Input aria-label={`Fact ${i + 1} value`} value={d.value} maxLength={120} placeholder="800 g" onChange={(e) => set("details", spec.details.map((x, n) => (n === i ? { ...x, value: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove fact ${i + 1}`} onClick={() => set("details", spec.details.filter((_, n) => n !== i))}><Trash2 /></Button>
            </div>
          ))}
          {spec.details.length < 6 && <Button type="button" variant="outline" size="sm" onClick={() => set("details", [...spec.details, { label: "", value: "" }])}><Plus /> Add a fact</Button>}
        </div>
      )}
    </fieldset>
  );
}
