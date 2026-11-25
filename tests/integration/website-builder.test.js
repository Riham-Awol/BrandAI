import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { setStorageAdapter } from "@/server/storage/index.js";
import { createDatabaseAdapter } from "@/server/storage/database-adapter.js";
import { createBusiness } from "@/server/businesses/service.js";
import { uploadBrandAsset } from "@/modules/brand/assets-service.js";
import {
  createWebsite, deleteWebsite, deleteSubmission, getPreviewMedia, getPublicMedia, getPublishedSite, getWebsite, listSubmissions, listWebsites,
  publishWebsite, regenerateSection, removeCustomDomain, restoreVersionToDraft, setCustomDomain, setDnsResolver, submitSiteForm, unpublishWebsite,
  updateSubmission, updateWebsite, verifyCustomDomain,
} from "@/modules/website/service.js";
import { createWebsiteSchema, siteConfigSchema, submissionSchema, updateWebsiteSchema } from "@/modules/website/schemas.js";
import { addMember, createUser, setPlan } from "../helpers/factories.js";

let prompts;
beforeEach(() => {
  prompts = [];
  setProviderOverrides({ text: createMockTextProvider({ responder: (req) => (prompts.push(req), mockFixtureResponder(req)) }) });
  setStorageAdapter(createDatabaseAdapter(prisma));
});
afterEach(() => {
  setProviderOverrides(null);
  setDnsResolver(null);
});

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);

async function setup() {
  const owner = await createUser();
  await setPlan(owner.workspace.id, "PRO"); // these scenarios use several businesses/websites
  const ws = owner.workspace.id;
  const biz = await createBusiness(owner.user, ws, { name: "Kirkgate Bakery", industry: "Bakery", stage: "STARTING" });
  return { owner, ws, biz };
}
const create = (ctx, over = {}) => createWebsite(ctx.owner.user, ctx.ws, createWebsiteSchema.parse({ businessId: ctx.biz.id, type: "BUSINESS", ...over }));
const save = (ctx, site, config, over = {}) => updateWebsite(ctx.owner.user, ctx.ws, site.id, updateWebsiteSchema.parse({ config, baseRevision: site.draftRevision, ...over }));

describe("creating websites", () => {
  it("writes a business site with AI, constrained to safe pages, sections and links", async () => {
    const ctx = await setup();
    await prisma.businessProduct.create({ data: { businessId: ctx.biz.id, name: "Country loaf", description: "Everyday sourdough", priceRange: "£4.50" } });
    const site = await create(ctx, { brief: "Show our bread and wholesale" });
    expect(site).toMatchObject({ type: "BUSINESS", slug: "kirkgate-bakery", status: "DRAFT", isMock: true, hasUnpublishedChanges: true });
    expect(site.config.pages.map((p) => p.slug)).toEqual(["home", "about", "services", "contact"]);
    expect(siteConfigSchema.safeParse(site.config).success).toBe(true);
    const hero = site.config.pages[0].sections[0];
    expect(hero).toMatchObject({ type: "hero", ctaLink: "/contact", secondaryLink: "" }); // "contact" → /contact; javascript: dropped
    const features = site.config.pages[0].sections.find((s) => s.type === "features");
    expect(features.items.map((i) => i.icon)).toEqual(["Wheat", "Leaf", ""]);
    // AI skipped the first planned section of the contact page: the app adds it.
    expect(site.config.pages[3].sections.map((s) => s.type)).toEqual(["contact"]);
    const req = prompts.at(-1);
    expect([req.module, req.task]).toEqual(["website", "site"]);
    expect(req.system).toContain("Never write HTML, CSS, JavaScript");
    expect(req.prompt).toContain("Country loaf (£4.50)");
  });

  it("uses real products for a store and offers a no-AI starter template", async () => {
    const ctx = await setup();
    await prisma.businessProduct.create({ data: { businessId: ctx.biz.id, name: "Seeded rye", priceRange: "£5" } });
    const store = await create(ctx, { type: "STORE" });
    const products = store.config.pages[0].sections.find((s) => s.type === "products");
    expect(products.items).toEqual([expect.objectContaining({ title: "Seeded rye", meta: "£5" })]);

    const n = prompts.length;
    const template = await create(ctx, { type: "LANDING", generate: false, theme: "bold" });
    expect(prompts.length).toBe(n);
    expect(template).toMatchObject({ isMock: false, slug: "kirkgate-bakery-2" });
    expect(template.config.theme).toBe("bold");
    expect(template.config.pages[0].sections[0].heading).toBe("Welcome to Kirkgate Bakery");
    expect(await listWebsites(ctx.owner.user, ctx.ws)).toHaveLength(2);
  });
});

describe("editing, publishing and the public site", () => {
  it("saves drafts with conflict detection, validates links and images, publishes snapshots", async () => {
    const ctx = await setup();
    let site = await create(ctx);
    const config = structuredClone(site.config);
    config.pages[0].sections[0].heading = "Fresh bread daily";
    site = await save(ctx, site, config);
    expect(site.draftRevision).toBe(2);
    await expect(updateWebsite(ctx.owner.user, ctx.ws, site.id, { config, baseRevision: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    const bad = structuredClone(config);
    bad.pages[0].sections[0].ctaLink = "javascript:alert(1)";
    expect(updateWebsiteSchema.safeParse({ config: bad }).success).toBe(false);

    // Images must be image assets of the same business.
    const other = await setup();
    const foreign = await uploadBrandAsset(other.owner.user, other.ws, other.biz.id, { buffer: png, originalName: "x.png", meta: { name: "X", kind: "IMAGE" } });
    const withForeign = structuredClone(site.config);
    withForeign.pages[0].sections[0].imageFileId = foreign.storedFile.id;
    await expect(save(ctx, site, withForeign)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const mine = await uploadBrandAsset(ctx.owner.user, ctx.ws, ctx.biz.id, { buffer: png, originalName: "loaf.png", meta: { name: "Loaf", kind: "IMAGE" } });
    const withMine = structuredClone(site.config);
    withMine.pages[0].sections[0].imageFileId = mine.storedFile.id;
    site = await save(ctx, site, withMine);
    expect(site.images).toEqual([{ fileId: mine.storedFile.id, name: "Loaf" }]);
    expect((await getPreviewMedia(ctx.owner.user, ctx.ws, site.id, mine.storedFile.id)).mime).toBe("image/png");

    // Not public until published.
    expect(await getPublishedSite(site.slug)).toBeNull();
    site = await publishWebsite(ctx.owner.user, ctx.ws, site.id);
    expect(site).toMatchObject({ status: "PUBLISHED", publishedVersion: 1, hasUnpublishedChanges: false });
    const live = await getPublishedSite(site.slug);
    expect(live.config.pages[0].sections[0].heading).toBe("Fresh bread daily");
    expect(live.brand).toMatchObject({ name: "Kirkgate Bakery", approved: false });
    expect((await getPublicMedia(site.slug, mine.storedFile.id)).mime).toBe("image/png");

    // Draft edits don't change the live site until republished.
    const next = structuredClone(site.config);
    next.pages[0].sections[0].heading = "Draft only";
    site = await save(ctx, site, next);
    expect(site.hasUnpublishedChanges).toBe(true);
    expect((await getPublishedSite(site.slug)).config.pages[0].sections[0].heading).toBe("Fresh bread daily");
    site = await restoreVersionToDraft(ctx.owner.user, ctx.ws, site.id, 1);
    expect(site.config.pages[0].sections[0].heading).toBe("Fresh bread daily");

    // Images not used by the published version are not served publicly.
    const unused = await uploadBrandAsset(ctx.owner.user, ctx.ws, ctx.biz.id, { buffer: png, originalName: "u.png", meta: { name: "U", kind: "IMAGE" } });
    await expect(getPublicMedia(site.slug, unused.storedFile.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    site = await unpublishWebsite(ctx.owner.user, ctx.ws, site.id);
    expect(await getPublishedSite(site.slug)).toBeNull();
  });

  it("changes the address only to free, valid slugs", async () => {
    const ctx = await setup();
    const a = await create(ctx, { generate: false });
    const b = await create(ctx, { generate: false });
    await expect(updateWebsite(ctx.owner.user, ctx.ws, b.id, { slug: a.slug })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateWebsite(ctx.owner.user, ctx.ws, b.id, { slug: "api" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await updateWebsite(ctx.owner.user, ctx.ws, b.id, { slug: "kirkgate-shop" })).slug).toBe("kirkgate-shop");
  });

  it("rewrites one section with AI but never testimonials", async () => {
    const ctx = await setup();
    let site = await create(ctx);
    const config = structuredClone(site.config);
    config.pages[0].sections.push({ ...config.pages[0].sections[0], id: "testimonials", type: "testimonials", heading: "Reviews", items: [] });
    site = await save(ctx, site, config);
    site = await regenerateSection(ctx.owner.user, ctx.ws, site.id, { pageSlug: "home", sectionId: "features", instructions: "Shorter" });
    const features = site.config.pages[0].sections.find((s) => s.id === "features");
    expect(features.heading).toBe("[Mock] Rewritten features");
    expect(prompts.at(-1).prompt).toContain("<revision_request>\nShorter");
    await expect(regenerateSection(ctx.owner.user, ctx.ws, site.id, { pageSlug: "home", sectionId: "testimonials" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(regenerateSection(ctx.owner.user, ctx.ws, site.id, { pageSlug: "home", sectionId: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("custom domains", () => {
  it("verifies ownership by TXT record before serving the domain", async () => {
    const ctx = await setup();
    let site = await create(ctx, { generate: false });
    await publishWebsite(ctx.owner.user, ctx.ws, site.id);
    site = await setCustomDomain(ctx.owner.user, ctx.ws, site.id, "www.kirkgate.example");
    expect(site.domain.records.map((r) => r.type)).toEqual(["CNAME", "TXT"]);
    expect(site.domainToken).toBeUndefined();
    const token = site.domain.records[1].value;
    expect(await getPublishedSite("www.kirkgate.example")).toBeNull();

    setDnsResolver(async () => [["something-else"]]);
    site = await verifyCustomDomain(ctx.owner.user, ctx.ws, site.id);
    expect(site.domainStatus).toBe("FAILED");
    setDnsResolver(async (name) => (name === "_brandai.www.kirkgate.example" ? [[token]] : []));
    site = await verifyCustomDomain(ctx.owner.user, ctx.ws, site.id);
    expect(site).toMatchObject({ domainStatus: "VERIFIED", urls: { domainUrl: "https://www.kirkgate.example" } });
    expect((await getPublishedSite("WWW.KIRKGATE.EXAMPLE")).viaDomain).toBe(true);

    const other = await setup();
    const otherSite = await create(other, { generate: false });
    await expect(setCustomDomain(other.owner.user, other.ws, otherSite.id, "www.kirkgate.example")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(setCustomDomain(other.owner.user, other.ws, otherSite.id, "localhost")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    site = await removeCustomDomain(ctx.owner.user, ctx.ws, site.id);
    expect(site.domain).toBeNull();
    expect(await getPublishedSite("www.kirkgate.example")).toBeNull();
  });
});

describe("contact and order messages", () => {
  it("stores submissions for published sites only and notifies the creator", async () => {
    const ctx = await setup();
    const site = await create(ctx, { generate: false });
    const form = submissionSchema.parse({ name: "Ann", email: "ann@example.com", message: "Two loaves please", kind: "order", item: "Country loaf", page: "/contact" });
    await expect(submitSiteForm(site.slug, form, { ip: "1.2.3.4" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await publishWebsite(ctx.owner.user, ctx.ws, site.id);
    await submitSiteForm(site.slug, form, { ip: "1.2.3.4" });
    const [msg] = await listSubmissions(ctx.owner.user, ctx.ws, site.id);
    expect(msg).toMatchObject({ kind: "order", item: "Country loaf", name: "Ann", readAt: null });
    expect(await prisma.notification.count({ where: { userId: ctx.owner.user.id, type: "website.message" } })).toBe(1);
    expect((await getWebsite(ctx.owner.user, ctx.ws, site.id)).unreadMessages).toBe(1);
    await updateSubmission(ctx.owner.user, ctx.ws, site.id, msg.id, { read: true });
    expect((await getWebsite(ctx.owner.user, ctx.ws, site.id)).unreadMessages).toBe(0);
    expect(submissionSchema.safeParse({ ...form, website: "http://spam" }).success).toBe(false);

    const other = await setup();
    await expect(listSubmissions(other.owner.user, other.ws, site.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteSubmission(other.owner.user, ctx.ws, site.id, msg.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await deleteSubmission(ctx.owner.user, ctx.ws, site.id, msg.id);
    expect(await listSubmissions(ctx.owner.user, ctx.ws, site.id)).toEqual([]);
  });
});

describe("permissions and isolation", () => {
  it("isolates workspaces, keeps viewers read-only and limits publishing to owners/admins", async () => {
    const ctx = await setup();
    const site = await create(ctx, { generate: false });
    const other = await createUser();
    await expect(getWebsite(other.user, other.workspace.id, site.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getWebsite(other.user, ctx.ws, site.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(publishWebsite(other.user, other.workspace.id, site.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createWebsite(other.user, other.workspace.id, createWebsiteSchema.parse({ businessId: ctx.biz.id, type: "BUSINESS" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listWebsites(other.user, other.workspace.id)).toEqual([]);

    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    const seen = await getWebsite(viewer.user, ctx.ws, site.id);
    expect(seen.permissions).toEqual({ canEdit: false, canGenerate: false, canPublish: false });
    await expect(updateWebsite(viewer.user, ctx.ws, site.id, { name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listSubmissions(viewer.user, ctx.ws, site.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const editor = await createUser();
    await addMember(ctx.ws, editor.user.id, "EDITOR");
    expect((await getWebsite(editor.user, ctx.ws, site.id)).permissions).toEqual({ canEdit: true, canGenerate: true, canPublish: false });
    await expect(publishWebsite(editor.user, ctx.ws, site.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setCustomDomain(editor.user, ctx.ws, site.id, "www.x.example")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteWebsite(editor.user, ctx.ws, site.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    await publishWebsite(ctx.owner.user, ctx.ws, site.id);
    const slug = site.slug;
    await deleteWebsite(ctx.owner.user, ctx.ws, site.id);
    expect(await getPublishedSite(slug)).toBeNull();
    await expect(getWebsite(ctx.owner.user, ctx.ws, site.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
