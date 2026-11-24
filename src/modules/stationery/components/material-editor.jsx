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
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MATERIAL_KINDS } from "../catalog.js";
import { MaterialFields, SvgPreview } from "./material-fields";

const slug = (s) => s.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 60) || "material";

export function MaterialEditor({ workspaceId, initialMaterial }) {
  const router = useRouter();
  const [material, setMaterial] = useState(initialMaterial);
  const [spec, setSpec] = useState(initialMaterial.spec);
  const [preview, setPreview] = useState({ views: [], key: null });
  const [viewKey, setViewKey] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = `/api/v1/workspaces/${workspaceId}/materials`;
  const kind = MATERIAL_KINDS[material.kind];
  const canEdit = material.permissions.canEdit;
  const dirty = useMemo(() => JSON.stringify(spec) !== JSON.stringify(material.spec), [spec, material.spec]);
  const currentKey = JSON.stringify(spec);
  const ready = preview.views.length > 0 && preview.key === currentKey;
  const view = preview.views.find((v) => v.key === viewKey) ?? preview.views[0];

  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    const key = JSON.stringify(spec);
    const t = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await apiRequest(`${base}/preview`, { method: "POST", body: { businessId: material.businessId, kind: material.kind, spec } });
        if (id === seq.current) {
          setPreview({ views: res.views, key });
          setErrors({});
          setError(null);
        }
      } catch (e) {
        if (id === seq.current) {
          setErrors(Object.fromEntries(Object.entries(e.details ?? {}).map(([k, v]) => [k.replace(/^spec\./, ""), v])));
          setError(e.code === "VALIDATION_ERROR" ? "Some fields need attention." : e.message);
        }
      } finally {
        if (id === seq.current) setPreviewing(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [base, material.businessId, material.kind, spec]);

  async function run(key, fn) {
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

  const applySaved = (next) => {
    setMaterial(next);
    setSpec(next.spec);
  };

  const exportSvg = () => ready && triggerDownload(new Blob([view.svg], { type: "image/svg+xml" }), `${slug(spec.name)}-${view.key}.svg`);
  // Print files are sized in mm: 300 dpi = 300/96 × the CSS-pixel size. Mockups export at 2×.
  const exportPng = () => run("png", async () => triggerDownload(await svgTextToPng(view.svg, view.print ? 300 / 96 : 2), `${slug(spec.name)}-${view.key}.png`));
  const print = () => ready && printSvg(view.svg, { paper: view.print ? `${view.widthMm}mm ${view.heightMm}mm` : undefined });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Link href="/stationery" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Stationery &amp; merchandise</Link>
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight">{material.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{kind.label} · {material.business.name} · version {material.version} {material.isMock && <Badge variant="warning">Mock</Badge>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportSvg} disabled={!ready}><Download /> SVG</Button>
          <Button variant="outline" onClick={exportPng} disabled={!ready || busy === "png"}>{busy === "png" ? <Loader2 className="animate-spin" /> : <Download />} PNG</Button>
          <Button variant="outline" onClick={print} disabled={!ready}><Printer /> Print / PDF</Button>
          {canEdit && (
            <Button disabled={!dirty || busy !== null} onClick={() => run("save", async () => applySaved(await apiRequest(`${base}/${material.id}`, { method: "PATCH", body: { spec } })))}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save changes" : "Saved"}
            </Button>
          )}
        </div>
      </div>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          {preview.views.length > 1 && (
            <div role="tablist" aria-label="Views" className="flex gap-1">
              {preview.views.map((v) => (
                <button key={v.key} role="tab" aria-selected={view?.key === v.key} onClick={() => setViewKey(v.key)} className={cn("rounded-md px-3 py-1.5 text-sm", view?.key === v.key ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{v.label}</button>
              ))}
            </div>
          )}
          <div className="mx-auto max-w-3xl">
            <SvgPreview svg={view?.svg} label={`Preview: ${spec.name} ${view?.label ?? ""}`} busy={previewing} background={view?.previewBackground} className="max-h-[70vh]" />
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {previewing || (preview.views.length > 0 && !ready) ? "Updating preview…" : view?.print ? `Print file: ${view.widthMm} × ${view.heightMm} mm${material.kind === "BUSINESS_CARD" ? " incl. 3 mm bleed" : ""} · PNG at 300 dpi` : view ? "Mockup for presentation — export the print file for production." : ""}
            {material.kind === "PACKAGING" && view?.key === "dieline" && " · red = cut, blue dashed = fold"}
          </p>
        </div>

        <div className="space-y-5">
          <Card className="gap-4">
            <MaterialFields kind={material.kind} spec={spec} onChange={setSpec} errors={errors} disabled={!canEdit} />
          </Card>
          {canEdit && (
            <Card className="gap-3">
              <h2 className="flex items-center gap-2 font-semibold"><History className="size-4" /> Versions</h2>
              <ul className="divide-y text-sm">
                {material.revisions.map((r) => (
                  <li key={r.version} className="flex items-center justify-between py-2">
                    <span>Version {r.version} <span className="text-muted-foreground">· {new Date(r.createdAt).toLocaleString()}</span></span>
                    {r.version === material.version ? <Badge variant="success">Current</Badge> : (
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(`r${r.version}`, async () => applySaved(await apiRequest(`${base}/${material.id}/revisions/${r.version}`, { method: "POST" })))}><Undo2 /> Restore</Button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run("dup", async () => router.push(`/stationery/materials/${(await apiRequest(`${base}/${material.id}/duplicate`, { method: "POST" })).id}`))}><Copy /> Duplicate</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{material.name}”?</DialogTitle>
            <DialogDescription>It will be removed from your stationery and merchandise.</DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy !== null} onClick={() => run("delete", async () => { await apiRequest(`${base}/${material.id}`, { method: "DELETE" }); router.push("/stationery"); })}><Trash2 /> Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
