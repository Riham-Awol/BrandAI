"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Info, Loader2, Plus, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { flattenZodError } from "@/validation/common.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { StructuredEditor } from "@/components/structured/structured-editor";
import { schemaToSpec } from "@/components/structured/schema-spec";
import { cn } from "@/lib/utils";
import { SECTION_TYPES, WEBSITE_TYPES, slugify } from "../catalog.js";
import { blankSection, newSectionId } from "../config-utils.js";
import { pageSchema, sectionSchema, siteConfigSchema } from "../schemas.js";
import { SitePreview } from "./site-preview";
import { PublishPanel } from "./publish-panel";
import { MessagesPanel } from "./messages-panel";

const SECTION_SPEC = (() => {
  const spec = schemaToSpec(sectionSchema);
  const items = spec.fields.find((f) => f.key === "items");
  items.item = { ...items.item, fields: items.item.fields.filter((f) => f.key !== "imageFileId") };
  return { ...spec, fields: spec.fields.filter((f) => !["id", "type", "imageFileId"].includes(f.key)) };
})();
const PAGE_SPEC = (() => {
  const spec = schemaToSpec(pageSchema);
  return { ...spec, fields: spec.fields.filter((f) => f.key !== "sections") };
})();
const SETTINGS_SPEC = (() => {
  const spec = schemaToSpec(siteConfigSchema);
  return { ...spec, fields: spec.fields.filter((f) => f.key !== "pages") };
})();

const TABS = [["content", "Content"], ["settings", "Settings"], ["publish", "Publish & domain"], ["messages", "Messages"]];

/** Errors for one section/page from a flattened config error map (keys like "pages.0.sections.2.ctaLink"). */
function scopedErrors(errors, prefix) {
  return Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]));
}

export function WebsiteEditor({ workspaceId, initialWebsite, ai }) {
  const router = useRouter();
  const params = useSearchParams();
  const [website, setWebsite] = useState(initialWebsite);
  const [config, setConfig] = useState(initialWebsite.config);
  const [pageSlug, setPageSlug] = useState("home");
  const [sectionId, setSectionId] = useState(initialWebsite.config.pages[0]?.sections[0]?.id ?? null);
  const [device, setDevice] = useState("desktop");
  const [tab, setTab] = useState(TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "content");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [instructions, setInstructions] = useState("");
  const base = `/api/v1/workspaces/${workspaceId}/websites/${website.id}`;
  const { canEdit, canGenerate, canPublish } = website.permissions;

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(website.config), [config, website.config]);
  const pageIndex = Math.max(0, config.pages.findIndex((p) => p.slug === pageSlug));
  const page = config.pages[pageIndex];
  const sectionIndex = page.sections.findIndex((s) => s.id === sectionId);
  const section = page.sections[sectionIndex] ?? null;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const updatePage = (fn) => setConfig((c) => ({ ...c, pages: c.pages.map((p, i) => (i === pageIndex ? fn(p) : p)) }));
  const updateSection = (next) => updatePage((p) => ({ ...p, sections: p.sections.map((s, i) => (i === sectionIndex ? next : s)) }));

  function moveSection(delta) {
    const to = sectionIndex + delta;
    if (to < 0 || to >= page.sections.length) return;
    updatePage((p) => {
      const sections = [...p.sections];
      [sections[sectionIndex], sections[to]] = [sections[to], sections[sectionIndex]];
      return { ...p, sections };
    });
  }

  function addSection(type) {
    const id = newSectionId(config, type);
    updatePage((p) => ({ ...p, sections: [...p.sections, blankSection(id, type, { heading: SECTION_TYPES[type].label })] }));
    setSectionId(id);
  }

  function removeSection() {
    const next = page.sections[sectionIndex + 1] ?? page.sections[sectionIndex - 1];
    updatePage((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== section.id) }));
    setSectionId(next?.id ?? null);
  }

  function addPage() {
    const used = new Set(config.pages.map((p) => p.slug));
    let n = 1;
    while (used.has(`page-${n}`)) n++;
    const slug = `page-${n}`;
    const id = newSectionId(config, "text");
    setConfig((c) => ({ ...c, pages: [...c.pages, { slug, title: `Page ${n}`, seoTitle: "", seoDescription: "", sections: [blankSection(id, "text", { heading: `Page ${n}` })] }] }));
    setPageSlug(slug);
    setSectionId(id);
  }

  function removePage() {
    if (page.slug === "home") return;
    setConfig((c) => ({ ...c, pages: c.pages.filter((p) => p.slug !== page.slug) }));
    selectPage("home");
  }

  function selectPage(slug) {
    const p = config.pages.find((x) => x.slug === slug) ?? config.pages[0];
    setPageSlug(p.slug);
    setSectionId(p.sections[0]?.id ?? null);
  }

  /** Validates locally (instant field errors), then saves the draft. Returns the saved website or null. */
  async function save() {
    const check = siteConfigSchema.safeParse(config);
    if (!check.success) {
      const flat = flattenZodError(check.error);
      setErrors(flat);
      const first = Object.keys(flat)[0]?.match(/^pages\.(\d+)(?:\.sections\.(\d+))?/);
      if (first) {
        const p = config.pages[Number(first[1])];
        setPageSlug(p.slug);
        if (first[2] !== undefined) setSectionId(p.sections[Number(first[2])].id);
      }
      setError("Some fields need attention — they are highlighted.");
      setTab("content");
      return null;
    }
    setBusy("save");
    setError(null);
    setErrors({});
    try {
      const next = await apiRequest(base, { method: "PATCH", body: { config: check.data, baseRevision: website.draftRevision } });
      setWebsite(next);
      setConfig(next.config);
      setNotice("Draft saved.");
      return next;
    } catch (e) {
      setError(e.message);
      if (e.details) setErrors(Object.fromEntries(Object.entries(e.details).map(([k, v]) => [k.replace(/^config\./, ""), v])));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    if (dirty && !(await save())) return;
    setBusy("ai");
    setError(null);
    try {
      const next = await apiRequest(`${base}/sections/regenerate`, { method: "POST", body: { pageSlug: page.slug, sectionId: section.id, instructions } });
      setWebsite(next);
      setConfig(next.config);
      setInstructions("");
      setNotice("Section rewritten and saved to the draft.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const applyServer = (next) => {
    setWebsite(next);
    setConfig(next.config);
  };

  const status = website.status === "PUBLISHED" ? (website.hasUnpublishedChanges ? ["warning", "Published · unpublished changes"] : ["success", `Published · v${website.publishedVersion}`]) : website.status === "UNPUBLISHED" ? ["warning", "Offline"] : ["secondary", "Draft"];
  const sectionErrors = section ? scopedErrors(errors, `pages.${pageIndex}.sections.${sectionIndex}.`) : {};
  const pageErrors = scopedErrors(errors, `pages.${pageIndex}.`);
  const mediaUrl = (fileId) => `${base}/media/${fileId}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Link href="/websites" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All websites</Link>
          <h1 className="truncate font-display text-3xl font-semibold tracking-tight">{website.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {WEBSITE_TYPES[website.type].label} · {website.business.name}
            <Badge variant={status[0]}>{status[1]}</Badge>
            {website.isMock && <Badge variant="warning">Mock</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {website.status === "PUBLISHED" && (
            <Button variant="outline" asChild><a href={website.urls.path} target="_blank" rel="noopener noreferrer"><ExternalLink /> View live site</a></Button>
          )}
          {canEdit && <Button variant="outline" onClick={save} disabled={!dirty || busy !== null}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save draft" : "Saved"}</Button>}
          {canPublish && (
            <Button
              disabled={busy !== null || (!dirty && website.status === "PUBLISHED" && !website.hasUnpublishedChanges)}
              onClick={async () => {
                const saved = dirty ? await save() : website;
                if (!saved) return;
                setBusy("publish");
                try {
                  applyServer(await apiRequest(`${base}/publish`, { method: "POST" }));
                  setNotice("Published. Your website is live.");
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === "publish" ? <Loader2 className="animate-spin" /> : <Upload />} Publish
            </Button>
          )}
        </div>
      </div>

      {!canEdit && <Alert variant="info"><Info /><AlertDescription>You have view-only access to this website.</AlertDescription></Alert>}
      {canEdit && !canPublish && <Alert variant="info"><Info /><AlertDescription>You can edit and save drafts. An owner or admin publishes the website.</AlertDescription></Alert>}
      {canEdit && website.status === "DRAFT" && !website.publishedVersion && (
        <Alert variant="info"><Info /><AlertTitle>Check the facts before you publish</AlertTitle><AlertDescription>AI-written text can include details that aren&apos;t true for your business (times, quantities, prices, claims). Read every section and correct anything that isn&apos;t accurate.</AlertDescription></Alert>
      )}
      {!website.brand.approved && <Alert variant="info"><Info /><AlertDescription>No approved brand identity yet — neutral colours and fonts are used. <Link className="font-medium underline" href="/brand">Create a brand identity</Link> and the site picks it up on the next publish.</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && !error && <p role="status" className="text-sm text-success">{notice}</p>}

      <div role="tablist" aria-label="Website editor" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium", tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
            {key === "messages" && website.unreadMessages > 0 && <Badge className="ml-2">{website.unreadMessages}</Badge>}
          </button>
        ))}
      </div>

      {tab === "content" && (
        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="gap-4">
              <div className="flex items-end gap-2">
                <div className="grid flex-1 gap-1.5">
                  <Label htmlFor="w-page">Page</Label>
                  <NativeSelect id="w-page" value={page.slug} onChange={(e) => selectPage(e.target.value)}>
                    {config.pages.map((p) => <option key={p.slug} value={p.slug}>{p.title || p.slug}</option>)}
                  </NativeSelect>
                </div>
                {canEdit && <Button variant="outline" size="icon" onClick={addPage} disabled={config.pages.length >= 10} aria-label="Add page"><Plus /></Button>}
                {canEdit && page.slug !== "home" && <Button variant="outline" size="icon" onClick={removePage} aria-label="Delete page"><Trash2 /></Button>}
              </div>
              <details className="rounded-lg border p-3 text-sm" open={Object.keys(pageErrors).some((k) => !k.startsWith("sections"))}>
                <summary className="cursor-pointer font-medium">Page title, address and search (SEO)</summary>
                <fieldset disabled={!canEdit} className="mt-3">
                  <StructuredEditor
                    spec={PAGE_SPEC}
                    value={page}
                    errors={pageErrors}
                    onChange={(next) => {
                      const slug = page.slug === "home" ? "home" : slugify(next.slug, 40) || page.slug;
                      updatePage((p) => ({ ...p, ...next, slug, sections: p.sections }));
                      if (slug !== page.slug) setPageSlug(slug);
                    }}
                  />
                  {page.slug === "home" && <p className="mt-2 text-xs text-muted-foreground">The home page address is fixed.</p>}
                </fieldset>
              </details>
              <div className="space-y-2">
                <p className="text-sm font-medium">Sections</p>
                <ol className="space-y-1">
                  {page.sections.map((s, i) => {
                    const hasError = Object.keys(errors).some((k) => k.startsWith(`pages.${pageIndex}.sections.${i}.`));
                    return (
                      <li key={s.id}>
                        <button type="button" onClick={() => setSectionId(s.id)} aria-current={s.id === sectionId ? "true" : undefined} className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm", s.id === sectionId ? "border-primary bg-accent/60" : "hover:bg-accent/40", hasError && "border-destructive")}>
                          <span className="min-w-0 truncate"><span className="font-medium">{SECTION_TYPES[s.type].label}</span>{s.heading && <span className="text-muted-foreground"> · {s.heading}</span>}</span>
                          {hasError && <AlertCircle className="size-4 shrink-0 text-destructive" aria-label="Has errors" />}
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {canEdit && (
                  <NativeSelect aria-label="Add a section" value="" onChange={(e) => e.target.value && addSection(e.target.value)}>
                    <option value="">+ Add a section…</option>
                    {Object.entries(SECTION_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label} — {t.description}</option>)}
                  </NativeSelect>
                )}
              </div>
            </Card>

            {section && (
              <Card className="gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">{SECTION_TYPES[section.type].label}</h2>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => moveSection(-1)} disabled={sectionIndex === 0} aria-label="Move section up"><ArrowUp /></Button>
                      <Button variant="ghost" size="icon" onClick={() => moveSection(1)} disabled={sectionIndex === page.sections.length - 1} aria-label="Move section down"><ArrowDown /></Button>
                      <Button variant="ghost" size="icon" onClick={removeSection} aria-label="Delete section"><Trash2 /></Button>
                    </div>
                  )}
                </div>
                {section.type === "testimonials" && <p className="text-xs text-muted-foreground">Add real quotes from your customers (name in Title, quote in Text). Brand AI never writes reviews.</p>}
                {canGenerate && canEdit && section.type !== "testimonials" && (
                  <div className="space-y-2 rounded-lg border border-highlight/40 bg-accent/30 p-3">
                    <Label htmlFor="w-instructions" className="text-xs">Rewrite with AI</Label>
                    <Textarea id="w-instructions" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Shorter, mention our weekend classes" />
                    <Button size="sm" variant="outline" onClick={regenerate} disabled={busy !== null || !ai.configured}>
                      {busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy === "ai" ? "Rewriting…" : "Rewrite section"}
                    </Button>
                  </div>
                )}
                <fieldset disabled={!canEdit} className="space-y-4">
                  <ImagePickers section={section} images={website.images} onChange={updateSection} />
                  <StructuredEditor spec={SECTION_SPEC} value={section} onChange={(next) => updateSection({ ...section, ...next })} errors={sectionErrors} />
                </fieldset>
              </Card>
            )}
          </div>

          <div className="h-[calc(100dvh-140px)] min-h-[520px] lg:sticky lg:top-20">
            <SitePreview
              config={config}
              brand={website.brand}
              year={new Date(website.updatedAt).getFullYear()}
              pageSlug={page.slug}
              device={device}
              onDevice={setDevice}
              onNavigate={selectPage}
              onSelectSection={(id) => {
                setSectionId(id);
                setTab("content");
              }}
              mediaUrl={mediaUrl}
              selectedSectionId={sectionId}
            />
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="gap-5">
            <h2 className="font-semibold">Site details</h2>
            <fieldset disabled={!canEdit}>
              <StructuredEditor spec={SETTINGS_SPEC} value={config} onChange={(next) => setConfig((c) => ({ ...c, ...next, pages: c.pages }))} errors={errors} />
            </fieldset>
            <p className="text-xs text-muted-foreground">Contact details appear on the contact section and footer exactly as you write them.</p>
          </Card>
          <NameAndAddress website={website} base={base} canEdit={canEdit} onSaved={applyServer} />
        </div>
      )}

      {tab === "publish" && <PublishPanel website={website} base={base} onChanged={applyServer} dirty={dirty} onDeleted={() => router.push("/websites")} />}
      {tab === "messages" && <MessagesPanel base={base} canEdit={canEdit} onChanged={async () => applyServer(await apiRequest(base))} />}
    </div>
  );
}

function ImagePickers({ section, images, onChange }) {
  const withItemImages = ["gallery", "products", "portfolio", "services", "features"].includes(section.type) && section.items.length > 0;
  const withSectionImage = ["hero", "about", "gallery"].includes(section.type);
  if (!withSectionImage && !withItemImages) return null;
  const options = (
    <>
      <option value="">No photo</option>
      {images.map((i) => <option key={i.fileId} value={i.fileId}>{i.name}</option>)}
    </>
  );
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Photos</p>
      {images.length === 0 && <p className="text-xs text-muted-foreground">Upload photos in the business&apos;s brand assets to use them here.</p>}
      {images.length > 0 && withSectionImage && (
        <div className="grid gap-1.5">
          <Label htmlFor="w-section-image" className="text-xs">Section photo</Label>
          <NativeSelect id="w-section-image" value={section.imageFileId} onChange={(e) => onChange({ ...section, imageFileId: e.target.value })}>{options}</NativeSelect>
        </div>
      )}
      {images.length > 0 && withItemImages && section.items.map((item, i) => (
        <div key={i} className="grid gap-1.5">
          <Label htmlFor={`w-item-image-${i}`} className="text-xs">Photo for “{item.title || `item ${i + 1}`}”</Label>
          <NativeSelect id={`w-item-image-${i}`} value={item.imageFileId} onChange={(e) => onChange({ ...section, items: section.items.map((it, n) => (n === i ? { ...it, imageFileId: e.target.value } : it)) })}>{options}</NativeSelect>
        </div>
      ))}
    </div>
  );
}

function NameAndAddress({ website, base, canEdit, onSaved }) {
  const [name, setName] = useState(website.name);
  const [slug, setSlug] = useState(website.slug);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  return (
    <Card className="gap-5">
      <h2 className="font-semibold">Name and address</h2>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErrors({});
          setMessage(null);
          try {
            onSaved(await apiRequest(base, { method: "PATCH", body: { name, slug } }));
            setMessage("Saved.");
          } catch (err) {
            setErrors(err.details ?? { _: [err.message] });
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={!canEdit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="w-name">Website name (only you see this)</Label>
            <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="w-slug">Address</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-muted-foreground">/sites/</span>
              <Input id="w-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={63} aria-invalid={Boolean(errors.slug) || undefined} />
            </div>
            {errors.slug && <p className="text-xs font-medium text-destructive">{errors.slug[0]}</p>}
            <p className="text-xs text-muted-foreground">Changing the address breaks links people already have.</p>
          </div>
          {errors._ && <p className="text-xs font-medium text-destructive">{errors._[0]}</p>}
          {message && <p role="status" className="text-sm text-success">{message}</p>}
          <Button type="submit" variant="outline" disabled={busy || (name === website.name && slug === website.slug)}>{busy && <Loader2 className="animate-spin" />} Save name and address</Button>
        </fieldset>
      </form>
      <Alert variant="info"><Info /><AlertTitle>Want your own domain?</AlertTitle><AlertDescription>Connect it under “Publish &amp; domain”.</AlertDescription></Alert>
    </Card>
  );
}
