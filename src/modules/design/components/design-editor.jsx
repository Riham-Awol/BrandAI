"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Copy, Download, History, Loader2, Printer, Save, Trash2, Undo2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { printSvg, svgTextToPng, triggerDownload } from "@/lib/download";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StructuredEditor } from "@/components/structured/structured-editor";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { ICON_GROUPS } from "@/modules/brand/catalog/icons.js";
import { COLOR_SCHEMES, DESIGN_FORMATS, DESIGN_KINDS, TEMPLATES, isPrint } from "../catalog.js";
import { designSpecSchema } from "../schemas.js";
import { DesignPreview } from "./design-preview";

const CONTENT_FIELDS = ["eyebrow", "headline", "subheadline", "body", "bullets", "badge", "cta", "details", "footer"];
const FULL_SPEC = schemaToSpec(designSpecSchema);
const CONTENT_SPEC = { ...FULL_SPEC, fields: CONTENT_FIELDS.map((k) => FULL_SPEC.fields.find((f) => f.key === k)) };

function slug(name) {
  return name.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 60) || "design";
}

export function DesignEditor({ workspaceId, initialDesign, images }) {
  const router = useRouter();
  const [design, setDesign] = useState(initialDesign);
  const [spec, setSpec] = useState(initialDesign.spec);
  const [format, setFormat] = useState(initialDesign.format);
  const [imageFileId, setImageFileId] = useState(initialDesign.imageFileId ?? "");
  const [preview, setPreview] = useState({ svg: null, warnings: [], key: null });
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(null);
  const canEdit = design.permissions.canEdit;
  const base = `/api/v1/workspaces/${workspaceId}/designs`;
  const fmt = DESIGN_FORMATS[format];
  const dirty = useMemo(
    () => JSON.stringify(spec) !== JSON.stringify(design.spec) || format !== design.format || (imageFileId || null) !== (design.imageFileId ?? null),
    [spec, format, imageFileId, design],
  );
  const set = (k, v) => setSpec((s) => ({ ...s, [k]: v }));
  const currentKey = JSON.stringify([spec, format, imageFileId]);
  // Exports use the preview only when it matches the current edits (never a stale render).
  const ready = Boolean(preview.svg) && preview.key === currentKey;

  // Live preview: re-render on the server (same renderer as exports) after a short pause.
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    const key = JSON.stringify([spec, format, imageFileId]);
    const t = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await apiRequest(`${base}/preview`, { method: "POST", body: { businessId: design.businessId, format, spec, imageFileId: imageFileId || null } });
        if (id === seq.current) {
          setPreview({ ...res, key });
          setFieldErrors({});
          setError(null);
        }
      } catch (e) {
        if (id === seq.current) {
          if (e.details) setFieldErrors(Object.fromEntries(Object.entries(e.details).map(([k, v]) => [k.replace(/^spec\./, ""), v])));
          setError(e.code === "VALIDATION_ERROR" ? "Some fields are too long — check the highlighted fields." : e.message);
        }
      } finally {
        if (id === seq.current) setPreviewing(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [base, design.businessId, format, spec, imageFileId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = await apiRequest(`${base}/${design.id}`, { method: "PATCH", body: { spec, format, imageFileId: imageFileId || null } });
      setDesign(next);
      setSpec(next.spec);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function action(key, fn) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const restore = (version) =>
    action(`restore-${version}`, async () => {
      const next = await apiRequest(`${base}/${design.id}/revisions/${version}`, { method: "POST" });
      setDesign(next);
      setSpec(next.spec);
      setFormat(next.format);
      setImageFileId(next.imageFileId ?? "");
    });

  const exportSvg = () => ready && triggerDownload(new Blob([preview.svg], { type: "image/svg+xml" }), `${slug(spec.name)}-${format}.svg`);
  const exportPng = () =>
    action("png", async () => {
      // Print sizes are drawn at 150 dpi; 2× gives 300 dpi.
      const png = await svgTextToPng(preview.svg, isPrint(format) ? 2 : 1);
      triggerDownload(png, `${slug(spec.name)}-${format}.png`);
    });
  const print = () => ready && printSvg(preview.svg, { paper: format === "a4_portrait" ? "A4 portrait" : format === "a5_portrait" ? "A5 portrait" : undefined });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Link href="/design" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All designs</Link>
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight">{design.name}</h1>
          <p className="text-sm text-muted-foreground">
            {DESIGN_KINDS[design.kind].label} · {design.business.name} · version {design.version}
            {design.isMock && <Badge variant="warning" className="ml-2">Mock</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportSvg} disabled={!ready}><Download /> SVG</Button>
          <Button variant="outline" onClick={exportPng} disabled={!ready || busy === "png"}>{busy === "png" ? <Loader2 className="animate-spin" /> : <Download />} PNG</Button>
          <Button variant="outline" onClick={print} disabled={!ready}><Printer /> Print / PDF</Button>
          {canEdit && <Button onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save changes" : "Saved"}</Button>}
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="mx-auto" style={{ maxWidth: fmt.height > fmt.width ? `${Math.round((fmt.width / fmt.height) * 720)}px` : undefined }}>
            <DesignPreview svg={preview.svg} width={fmt.width} height={fmt.height} label={`Preview: ${spec.headline}`} busy={previewing} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span>{fmt.label}{isPrint(format) ? " · PNG exports at 300 dpi" : ""}</span>
            {previewing || (preview.svg && !ready) ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Updating preview…</span> : dirty && canEdit ? <span>Unsaved changes</span> : null}
          </div>
          {preview.warnings?.length > 0 && (
            <ul className="space-y-1 text-xs text-warning">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
        </div>

        <div className="space-y-5">
          <fieldset disabled={!canEdit} className="contents">
            <Card className="gap-5">
              <h2 className="text-base font-semibold">Layout</h2>
              <div className="grid gap-1.5">
                <Label htmlFor="d-name">Name</Label>
                <Input id="d-name" value={spec.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="d-template">Template</Label>
                  <NativeSelect id="d-template" value={spec.template} onChange={(e) => set("template", e.target.value)}>
                    {Object.entries(TEMPLATES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="d-scheme">Colours</Label>
                  <NativeSelect id="d-scheme" value={spec.colorScheme} onChange={(e) => set("colorScheme", e.target.value)}>
                    {Object.entries(COLOR_SCHEMES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="d-format">Size</Label>
                  <NativeSelect id="d-format" value={format} onChange={(e) => setFormat(e.target.value)}>
                    {DESIGN_KINDS[design.kind].formats.map((f) => <option key={f} value={f}>{DESIGN_FORMATS[f].label}</option>)}
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="d-image">Photo</Label>
                  <NativeSelect id="d-image" value={imageFileId} onChange={(e) => setImageFileId(e.target.value)}>
                    <option value="">No photo</option>
                    {images.map((i) => <option key={i.fileId} value={i.fileId}>{i.name}</option>)}
                  </NativeSelect>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="d-icon">Icon</Label>
                  <NativeSelect id="d-icon" value={spec.icon} onChange={(e) => set("icon", e.target.value)}>
                    <option value="">No icon</option>
                    {Object.entries(ICON_GROUPS).map(([group, names]) => (
                      <optgroup key={group} label={group}>{names.map((n) => <option key={n} value={n}>{n}</option>)}</optgroup>
                    ))}
                  </NativeSelect>
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" checked={spec.showLogo} onChange={(e) => set("showLogo", e.target.checked)} /> Show logo
                </label>
              </div>
              {spec.template === "split_image" && !imageFileId && <p className="text-xs text-muted-foreground">No photo chosen: the image area shows your icon on a tinted panel.</p>}
            </Card>
            <Card className="gap-5">
              <h2 className="text-base font-semibold">Text</h2>
              <StructuredEditor spec={CONTENT_SPEC} value={spec} onChange={setSpec} errors={fieldErrors} />
            </Card>
          </fieldset>

          {canEdit && (
            <Card className="gap-4">
              <h2 className="flex items-center gap-2 text-base font-semibold"><History className="size-4" /> Versions</h2>
              <ul className="divide-y text-sm">
                {design.revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <span>Version {r.version} <span className="text-muted-foreground">· {DESIGN_FORMATS[r.format].label.split(" ")[0]} · {new Date(r.createdAt).toLocaleString()}</span></span>
                    {r.version === design.version ? (
                      <Badge variant="success">Current</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => restore(r.version)} disabled={busy !== null}>
                        {busy === `restore-${r.version}` ? <Loader2 className="animate-spin" /> : <Undo2 />} Restore
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => action("dup", async () => router.push(`/design/${(await apiRequest(`${base}/${design.id}/duplicate`, { method: "POST" })).id}`))}>
                  {busy === "dup" ? <Loader2 className="animate-spin" /> : <Copy />} Duplicate
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this design?</DialogTitle>
            <DialogDescription>“{design.name}” and its versions will be removed from the gallery.</DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => action("delete", async () => {
                await apiRequest(`${base}/${design.id}`, { method: "DELETE" });
                router.push("/design");
              })}
            >
              {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
