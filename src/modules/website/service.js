import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { assertPlanAllows } from "@/server/billing/entitlements.js";
import { resolveSiteBrand } from "@/server/brand/approved-brand.js";
import { findBusinessImage, listBusinessImages, readBusinessImage } from "@/server/storage/business-images.js";
import { notify } from "@/server/notifications/service.js";
import { getEnv } from "@/server/config/env.js";
import { uuidSchema } from "@/validation/common.js";
import { RESERVED_SLUGS, SLUG_RE, slugify } from "./catalog.js";
import { blankSection, buildConfigFromAi, findPage, referencedFileIds, sectionFromAi, templateConfig } from "./config-utils.js";
import { aiSectionSchema, aiSiteSchema, siteConfigSchema } from "./schemas.js";
import { sectionInput, sectionInstructions, siteInput, siteInstructions } from "./prompts.js";
import "./mock-fixtures.js";

const listSelect = {
  id: true, businessId: true, type: true, name: true, slug: true, status: true, publishedAt: true, publishedVersion: true,
  customDomain: true, domainStatus: true, isMock: true, createdAt: true, updatedAt: true,
  business: { select: { id: true, name: true } },
};

// ── URLs and domains ────────────────────────────────────────────────────────

function appUrl() {
  return getEnv().APP_URL.replace(/\/+$/, "");
}

/** Public URLs for a website (path on the app domain, plus the verified custom domain). */
export function siteUrls(website) {
  return {
    path: `/sites/${website.slug}`,
    url: `${appUrl()}/sites/${website.slug}`,
    domainUrl: website.customDomain && website.domainStatus === "VERIFIED" ? `https://${website.customDomain}` : null,
  };
}

export function domainInstructions(website) {
  if (!website.customDomain) return null;
  const target = getEnv().SITES_CNAME_TARGET || new URL(appUrl()).host;
  return {
    domain: website.customDomain,
    status: website.domainStatus,
    checkedAt: website.domainCheckedAt,
    records: [
      { type: "CNAME", name: website.customDomain, value: target, purpose: "Points the domain at Brand AI" },
      { type: "TXT", name: `_brandai.${website.customDomain}`, value: `brandai-verify=${website.domainToken}`, purpose: "Proves you own the domain" },
    ],
  };
}

let dnsTxt = (name) => resolveTxt(name);
/** Test hook: replace DNS lookups. */
export function setDnsResolver(fn) {
  dnsTxt = fn ?? ((name) => resolveTxt(name));
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function findWebsite(scope, websiteId) {
  if (!uuidSchema.safeParse(websiteId).success) throw Errors.notFound();
  const website = await prisma.website.findFirst({ where: { id: websiteId, workspaceId: scope.workspaceId, deletedAt: null }, include: { business: { select: { id: true, name: true, industry: true, description: true } } } });
  if (!website) throw Errors.notFound();
  return website;
}

async function uniqueSlug(base) {
  const root = (slugify(base, 50) || "site").replace(/^-+/, "");
  const start = RESERVED_SLUGS.has(root) ? `${root}-site` : root;
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? start : `${start}-${n}`;
    if (!(await prisma.website.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `${start}-${randomBytes(3).toString("hex")}`;
}

async function profileFor(businessId) {
  const [products, services, location] = await Promise.all([
    prisma.businessProduct.findMany({ where: { businessId }, orderBy: { sortOrder: "asc" }, take: 24 }),
    prisma.businessService.findMany({ where: { businessId }, orderBy: { sortOrder: "asc" }, take: 24 }),
    prisma.businessLocation.findFirst({ where: { businessId, isOnline: false }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
  ]);
  const address = location ? [location.label, location.city, location.region, location.country].filter(Boolean).join(", ") : "";
  return { products, services, contact: { email: "", phone: "", address, hours: "" } };
}

/** Every image a config uses must be an image asset of the same business. */
async function assertImages(website, config) {
  for (const fileId of referencedFileIds(config)) await findBusinessImage(website.workspaceId, website.businessId, fileId);
}

function present(website, scope, extra = {}) {
  const { domainToken: _t, config, business, ...rest } = website;
  return {
    ...rest,
    business: { id: business.id, name: business.name },
    config,
    urls: siteUrls(website),
    domain: domainInstructions(website),
    permissions: {
      canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE),
      canGenerate: scope.can(PERMISSIONS.AI_GENERATE),
      canPublish: scope.can(PERMISSIONS.WEBSITE_PUBLISH),
    },
    ...extra,
  };
}

// ── Studio (authenticated) ───────────────────────────────────────────────────

export async function listWebsites(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const sites = await prisma.website.findMany({ where: { workspaceId: scope.workspaceId, deletedAt: null }, orderBy: { updatedAt: "desc" }, select: listSelect, take: 200 });
  return sites.map((s) => ({ ...s, urls: siteUrls(s) }));
}

export async function getWebsite(user, workspaceId, websiteId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const website = await findWebsite(scope, websiteId);
  const [brand, images, unread, published] = await Promise.all([
    resolveSiteBrand(website.businessId, website.business),
    listBusinessImages(scope, website.businessId),
    prisma.websiteSubmission.count({ where: { websiteId: website.id, readAt: null } }),
    website.publishedVersion
      ? prisma.websiteVersion.findUnique({ where: { websiteId_version: { websiteId: website.id, version: website.publishedVersion } }, select: { config: true } })
      : null,
  ]);
  // Both sides are stored as MySQL JSON (same key normalization), so a string compare is reliable.
  const hasUnpublishedChanges = !published || JSON.stringify(published.config) !== JSON.stringify(website.config);
  return present(website, scope, { brand, images, unreadMessages: unread, hasUnpublishedChanges });
}

/** Creates a website: AI-written (one call) or from the starter template. */
export async function createWebsite(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, input.generate ? PERMISSIONS.AI_GENERATE : PERMISSIONS.BUSINESS_UPDATE);
  if (!scope.can(PERMISSIONS.BUSINESS_UPDATE)) throw Errors.forbidden();
  const business = await findScopedBusiness(scope, input.businessId);
  await assertPlanAllows(scope.workspaceId, "websites");
  const profile = await profileFor(business.id);

  let config;
  let isMock = false;
  if (input.generate) {
    const result = await generateText({
      user, workspaceId, businessId: business.id, module: "website", task: "site",
      instructions: siteInstructions({ type: input.type, theme: input.theme }),
      input: siteInput({ business, brief: input.brief, products: profile.products, services: profile.services }),
      schema: aiSiteSchema, effort: "medium", maxTokens: 14000, request,
    });
    config = buildConfigFromAi(result.data, { type: input.type, theme: input.theme, ...profile });
    isMock = result.isMock;
  } else {
    config = templateConfig({ type: input.type, theme: input.theme, businessName: business.name, ...profile });
  }
  config = siteConfigSchema.parse(config);

  const website = await prisma.website.create({
    data: {
      workspaceId: scope.workspaceId, businessId: business.id, type: input.type, name: `${business.name} website`.slice(0, 160),
      slug: await uniqueSlug(business.name), config, isMock, createdById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({ action: "website.created", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, metadata: { type: input.type, generated: input.generate }, request });
  return getWebsite(user, workspaceId, website.id);
}

/** Saves the draft. `baseRevision` guards against overwriting someone else's newer edit. */
export async function updateWebsite(user, workspaceId, websiteId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const website = await findWebsite(scope, websiteId);
  if (input.baseRevision && input.baseRevision !== website.draftRevision) {
    throw new AppError("CONFLICT", "This website was changed by someone else. Reload to get the latest version.", 409, { draftRevision: website.draftRevision });
  }
  const data = {};
  if (input.name) data.name = input.name;
  if (input.slug && input.slug !== website.slug) {
    if (!SLUG_RE.test(input.slug) || RESERVED_SLUGS.has(input.slug)) throw Errors.validation({ slug: ["This address is not available."] });
    const taken = await prisma.website.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (taken) throw Errors.validation({ slug: ["This address is already taken."] });
    data.slug = input.slug;
  }
  if (input.config) {
    await assertImages(website, input.config);
    data.config = input.config;
    data.draftRevision = website.draftRevision + 1;
  }
  await prisma.website.update({ where: { id: website.id }, data });
  await recordAudit({ action: "website.updated", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, request });
  return getWebsite(user, workspaceId, website.id);
}

/** Rewrites one section with AI and saves it into the draft. */
export async function regenerateSection(user, workspaceId, websiteId, { pageSlug, sectionId, instructions }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AI_GENERATE);
  if (!scope.can(PERMISSIONS.BUSINESS_UPDATE)) throw Errors.forbidden();
  const website = await findWebsite(scope, websiteId);
  const config = structuredClone(website.config);
  const page = findPage(config, pageSlug);
  const index = page?.sections.findIndex((s) => s.id === sectionId) ?? -1;
  if (index < 0) throw Errors.notFound();
  const current = page.sections[index];
  if (current.type === "testimonials") throw Errors.validation({ sectionId: ["Testimonials must be real quotes from your customers; Brand AI does not write them."] });

  const result = await generateText({
    user, workspaceId, businessId: website.businessId, module: "website", task: "section",
    instructions: sectionInstructions(current.type),
    input: sectionInput({ business: website.business, page, section: current, instructions }),
    schema: aiSectionSchema, effort: "low", maxTokens: 4000, request,
  });
  const next = sectionFromAi({ ...result.data, type: current.type }, current.id, config.pages.map((p) => p.slug));
  // Keep owner-controlled parts: images, background and real catalogue items.
  page.sections[index] = { ...next, imageFileId: current.imageFileId, background: current.background, items: ["products", "services"].includes(current.type) && current.items.length ? current.items : next.items };
  await prisma.website.update({ where: { id: website.id }, data: { config: siteConfigSchema.parse(config), draftRevision: website.draftRevision + 1, isMock: website.isMock || result.isMock } });
  await recordAudit({ action: "website.section_regenerated", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, metadata: { pageSlug, sectionId }, request });
  return getWebsite(user, workspaceId, website.id);
}

/** Publishing snapshots the draft and the brand; the live site shows only published versions. */
export async function publishWebsite(user, workspaceId, websiteId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WEBSITE_PUBLISH);
  const website = await findWebsite(scope, websiteId);
  const check = siteConfigSchema.safeParse(website.config);
  if (!check.success) throw Errors.validation({ config: ["Fix the highlighted problems before publishing."] });
  await assertImages(website, check.data);
  const brand = await resolveSiteBrand(website.businessId, website.business);
  const version = await prisma.$transaction(async (tx) => {
    const last = await tx.websiteVersion.findFirst({ where: { websiteId: website.id }, orderBy: { version: "desc" }, select: { version: true } });
    const v = (last?.version ?? 0) + 1;
    await tx.websiteVersion.create({ data: { websiteId: website.id, version: v, config: check.data, brand, publishedById: user.id } });
    await tx.website.update({ where: { id: website.id }, data: { status: "PUBLISHED", publishedVersion: v, publishedAt: new Date() } });
    return v;
  });
  await recordAudit({ action: "website.published", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, metadata: { version }, request });
  return getWebsite(user, workspaceId, website.id);
}

export async function unpublishWebsite(user, workspaceId, websiteId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WEBSITE_PUBLISH);
  const website = await findWebsite(scope, websiteId);
  await prisma.website.update({ where: { id: website.id }, data: { status: "UNPUBLISHED" } });
  await recordAudit({ action: "website.unpublished", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, request });
  return getWebsite(user, workspaceId, website.id);
}

export async function listWebsiteVersions(user, workspaceId, websiteId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const website = await findWebsite(scope, websiteId);
  return prisma.websiteVersion.findMany({ where: { websiteId: website.id }, orderBy: { version: "desc" }, select: { version: true, publishedAt: true, publishedById: true } });
}

/** Copies a published version back into the draft (does not change the live site). */
export async function restoreVersionToDraft(user, workspaceId, websiteId, version, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const website = await findWebsite(scope, websiteId);
  const row = await prisma.websiteVersion.findFirst({ where: { websiteId: website.id, version } });
  if (!row) throw Errors.notFound();
  await prisma.website.update({ where: { id: website.id }, data: { config: row.config, draftRevision: website.draftRevision + 1 } });
  await recordAudit({ action: "website.version_restored", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, metadata: { version }, request });
  return getWebsite(user, workspaceId, website.id);
}

export async function deleteWebsite(user, workspaceId, websiteId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_DELETE);
  const website = await findWebsite(scope, websiteId);
  // Frees the address and domain for reuse; the row is kept (soft delete).
  await prisma.website.update({ where: { id: website.id }, data: { deletedAt: new Date(), status: "UNPUBLISHED", slug: `x-${website.id}`, customDomain: null, domainStatus: null, domainToken: null } });
  await recordAudit({ action: "website.deleted", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, request });
}

// ── Domains ────────────────────────────────────────────────────────────────

export async function setCustomDomain(user, workspaceId, websiteId, domain, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WEBSITE_PUBLISH);
  const website = await findWebsite(scope, websiteId);
  const appHost = new URL(appUrl()).hostname;
  if (domain === appHost || domain.endsWith(`.${appHost}`) || /^(localhost|.*\.local|.*\.internal)$/.test(domain)) throw Errors.validation({ domain: ["Use your own domain."] });
  const taken = await prisma.website.findFirst({ where: { customDomain: domain, id: { not: website.id } }, select: { id: true } });
  if (taken) throw Errors.validation({ domain: ["This domain is already connected to another website."] });
  await prisma.website.update({ where: { id: website.id }, data: { customDomain: domain, domainStatus: "PENDING", domainToken: randomBytes(16).toString("hex"), domainCheckedAt: null } });
  await recordAudit({ action: "website.domain_set", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, metadata: { domain }, request });
  return getWebsite(user, workspaceId, website.id);
}

/** Checks the TXT record; the site is served on the domain only once verified. */
export async function verifyCustomDomain(user, workspaceId, websiteId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WEBSITE_PUBLISH);
  const website = await findWebsite(scope, websiteId);
  if (!website.customDomain) throw Errors.validation({ domain: ["Add a domain first."] });
  let records = [];
  try {
    records = (await Promise.race([dnsTxt(`_brandai.${website.customDomain}`), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000))])).map((r) => r.join(""));
  } catch {
    records = [];
  }
  const ok = records.includes(`brandai-verify=${website.domainToken}`);
  await prisma.website.update({ where: { id: website.id }, data: { domainStatus: ok ? "VERIFIED" : "FAILED", domainCheckedAt: new Date() } });
  await recordAudit({ action: "website.domain_checked", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, metadata: { domain: website.customDomain, verified: ok }, request });
  return getWebsite(user, workspaceId, website.id);
}

export async function removeCustomDomain(user, workspaceId, websiteId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WEBSITE_PUBLISH);
  const website = await findWebsite(scope, websiteId);
  await prisma.website.update({ where: { id: website.id }, data: { customDomain: null, domainStatus: null, domainToken: null, domainCheckedAt: null } });
  await recordAudit({ action: "website.domain_removed", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, request });
  return getWebsite(user, workspaceId, website.id);
}

// ── Messages (form submissions) ─────────────────────────────────────────────

export async function listSubmissions(user, workspaceId, websiteId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const website = await findWebsite(scope, websiteId);
  return prisma.websiteSubmission.findMany({
    where: { websiteId: website.id }, orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, kind: true, name: true, email: true, phone: true, message: true, item: true, pagePath: true, readAt: true, createdAt: true },
  });
}

export async function updateSubmission(user, workspaceId, websiteId, submissionId, { read }) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const website = await findWebsite(scope, websiteId);
  if (!uuidSchema.safeParse(submissionId).success) throw Errors.notFound();
  const { count } = await prisma.websiteSubmission.updateMany({ where: { id: submissionId, websiteId: website.id }, data: { readAt: read ? new Date() : null } });
  if (!count) throw Errors.notFound();
}

export async function deleteSubmission(user, workspaceId, websiteId, submissionId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const website = await findWebsite(scope, websiteId);
  if (!uuidSchema.safeParse(submissionId).success) throw Errors.notFound();
  const { count } = await prisma.websiteSubmission.deleteMany({ where: { id: submissionId, websiteId: website.id } });
  if (!count) throw Errors.notFound();
  await recordAudit({ action: "website.message_deleted", actorId: user.id, workspaceId, entityType: "website", entityId: website.id, request });
}

/** Image for the editor preview (any image asset of the website's business). */
export async function getPreviewMedia(user, workspaceId, websiteId, fileId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const website = await findWebsite(scope, websiteId);
  const file = await findBusinessImage(website.workspaceId, website.businessId, fileId);
  return readBusinessImage(file, { preferUrl: true });
}

// ── Public site (no login) ───────────────────────────────────────────────────

/**
 * Resolves a public site by slug ("kirkgate-bakery") or verified custom domain
 * ("www.example.com"). Only published, non-deleted sites are returned.
 */
export async function getPublishedSite(siteKey) {
  const key = String(siteKey ?? "").toLowerCase();
  const where = key.includes(".") ? { customDomain: key, domainStatus: "VERIFIED" } : SLUG_RE.test(key) ? { slug: key } : null;
  if (!where) return null;
  const website = await prisma.website.findFirst({ where: { ...where, deletedAt: null, status: "PUBLISHED" }, select: { id: true, workspaceId: true, businessId: true, slug: true, customDomain: true, domainStatus: true, publishedVersion: true, createdById: true, name: true } });
  if (!website?.publishedVersion) return null;
  const version = await prisma.websiteVersion.findUnique({ where: { websiteId_version: { websiteId: website.id, version: website.publishedVersion } }, select: { config: true, brand: true, publishedAt: true } });
  if (!version) return null;
  return { website, config: version.config, brand: version.brand, publishedAt: version.publishedAt, viaDomain: key.includes(".") };
}

/** Image of a published site: must be referenced by the published config and belong to the business. */
export async function getPublicMedia(siteKey, fileId) {
  const site = await getPublishedSite(siteKey);
  if (!site || !uuidSchema.safeParse(fileId).success || !referencedFileIds(site.config).has(fileId)) throw Errors.notFound();
  let file;
  try {
    file = await findBusinessImage(site.website.workspaceId, site.website.businessId, fileId);
  } catch {
    throw Errors.notFound();
  }
  return readBusinessImage(file, { preferUrl: true });
}

/** Stores a contact/order message from a published site and notifies the site's creator. */
export async function submitSiteForm(siteKey, input, { ip }) {
  const site = await getPublishedSite(siteKey);
  if (!site) throw Errors.notFound();
  const secret = getEnv().NEXTAUTH_SECRET ?? "dev";
  const ipHash = createHash("sha256").update(`${secret}:${ip ?? "unknown"}`).digest("hex");
  const submission = await prisma.websiteSubmission.create({
    data: {
      websiteId: site.website.id, workspaceId: site.website.workspaceId, kind: input.kind, name: input.name, email: input.email,
      phone: input.phone ?? null, message: input.message, item: input.item ?? null, pagePath: input.page.slice(0, 200), ipHash,
    },
    select: { id: true },
  });
  await notify({
    userId: site.website.createdById, workspaceId: site.website.workspaceId, type: "website.message",
    title: input.kind === "order" ? `New order enquiry on ${site.website.name}` : `New message on ${site.website.name}`,
    body: `${input.name}${input.item ? ` · ${input.item}` : ""}`, link: `/websites/${site.website.id}?tab=messages`,
  });
  return submission;
}

export { blankSection };
