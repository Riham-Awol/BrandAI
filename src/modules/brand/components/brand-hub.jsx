"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, FileText, Loader2, Palette, Trash2, Upload } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FONT_BY_KEY } from "../catalog/fonts.js";
import { ContrastChecks, PaletteSwatches } from "./brand-views";
import { LogoVariants } from "./logo-variants";
import { brandFontFamily, useBrandFonts } from "./use-brand-fonts";

export function BrandHub({ workspaceId, business, identity, initialAssets, permissions }) {
  const [error, setError] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}/businesses/${business.id}`;
  const slug = business.name.replace(/[^\w-]+/g, "-").toLowerCase() || "logo";
  return (
    <div className="space-y-8">
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {identity ? (
        <ApprovedIdentity identity={identity} base={base} slug={slug} onError={setError} businessId={business.id} />
      ) : (
        <EmptyState
          icon={Palette}
          title="No approved brand identity yet"
          description="Create your logo, colours, typography and voice in the Brand Identity Studio, then approve them here."
          action={<Button asChild><Link href={`/brand/new?business=${business.id}`}>Open Brand Identity Studio</Link></Button>}
        />
      )}
      <AssetLibrary base={base} workspaceId={workspaceId} initialAssets={initialAssets} permissions={permissions} />
    </div>
  );
}

function ApprovedIdentity({ identity, base, slug, onError, businessId }) {
  const d = identity.data;
  const fontsReady = useBrandFonts(d.typography ? [{ key: d.typography.heading.fontKey, weight: d.typography.heading.weight }, { key: d.typography.body.fontKey, weight: d.typography.body.weight }] : []);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <Badge variant="success" className="mr-2">Approved v{identity.version}</Badge>
          {new Date(identity.approvedAt).toLocaleDateString()}
        </p>
        <div className="flex gap-2">
          {identity.projectId && <Button variant="outline" asChild><Link href={`/brand/${identity.projectId}`}>Edit in studio</Link></Button>}
          <Button asChild><Link href={`/businesses/${businessId}/brand/guidelines`}><FileText /> Brand guidelines</Link></Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Logo files</CardTitle>
          <CardDescription>Vector SVG for print and design tools; high-resolution PNG for everyday use.</CardDescription>
        </CardHeader>
        <LogoVariants downloadable filenameBase={`${slug}-logo`} onError={onError} srcFor={(variant, theme) => `${base}/brand/logo?variant=${variant}&theme=${theme}&height=240`} />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Colours</CardTitle><CardDescription>{d.palette.name} — {d.palette.mood}</CardDescription></CardHeader>
          <PaletteSwatches colors={d.palette.colors} size="lg" />
          <ContrastChecks colors={d.palette.colors} />
        </Card>
        <Card>
          <CardHeader><CardTitle>Typography</CardTitle><CardDescription>{d.typography.name}</CardDescription></CardHeader>
          <div className={fontsReady ? "space-y-3" : "space-y-3 opacity-40"}>
            <p style={{ fontFamily: brandFontFamily(d.typography.heading.fontKey), fontWeight: Number(d.typography.heading.weight) }} className="text-3xl">
              {FONT_BY_KEY[d.typography.heading.fontKey]?.family} {d.typography.heading.weight}
            </p>
            <p style={{ fontFamily: brandFontFamily(d.typography.body.fontKey), fontWeight: Number(d.typography.body.weight) }} className="text-[15px] leading-relaxed">
              {FONT_BY_KEY[d.typography.body.fontKey]?.family} {d.typography.body.weight} — body text for paragraphs, captions and interfaces.
            </p>
          </div>
          {d.tagline && <p className="border-t pt-4 font-display text-xl">“{d.tagline}”</p>}
        </Card>
      </div>
    </>
  );
}

const KINDS = [["LOGO", "Logo"], ["ICON", "Icon"], ["IMAGE", "Image"], ["DOCUMENT", "Document"], ["OTHER", "Other"]];

function AssetLibrary({ base, workspaceId, initialAssets, permissions }) {
  const [assets, setAssets] = useState(initialAssets);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function upload(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/brand-assets`, { method: "POST", body: new FormData(form) });
      const payload = await res.json();
      if (!payload.ok) throw new Error(payload.error.message);
      setAssets((list) => [payload.data, ...list]);
      form.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id) {
    setError(null);
    try {
      await apiRequest(`${base}/brand-assets/${id}`, { method: "DELETE" });
      setAssets((list) => list.filter((a) => a.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  const fileUrl = (a, download = false) => `/api/v1/workspaces/${workspaceId}/files/${a.storedFile.id}/content${download ? "?download=1" : ""}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand asset library</CardTitle>
        <CardDescription>Keep existing logos, photos and documents with your brand. PNG, JPEG, GIF, WebP or PDF, up to 5 MB.</CardDescription>
      </CardHeader>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {permissions.canUpload && (
        <form onSubmit={upload} className="grid gap-4 rounded-xl border bg-background/50 p-4 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="asset-file">File</Label>
            <Input id="asset-file" name="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="asset-name">Name</Label>
            <Input id="asset-name" name="name" placeholder="e.g. Shopfront photo" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="asset-kind">Type</Label>
            <NativeSelect id="asset-kind" name="kind" defaultValue="IMAGE">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
          </div>
          <Button type="submit" disabled={uploading}>{uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload</Button>
        </form>
      )}
      {assets.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="relative grid place-items-center h-32 bg-muted/50">
                {a.storedFile.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(a)} alt={a.name} className="absolute inset-0 h-full w-full object-contain p-2" loading="lazy" />
                ) : (
                  <FileText className="size-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.kind.toLowerCase()} · {(a.storedFile.sizeBytes / 1024).toFixed(0)} KB</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" asChild><a href={fileUrl(a, true)} aria-label={`Download ${a.name}`}>Download</a></Button>
                  {permissions.canDelete && (
                    <Button size="icon" variant="ghost" className="size-8" aria-label={`Delete ${a.name}`} onClick={() => remove(a.id)}><Trash2 className="size-4" /></Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
