import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { setStorageAdapter } from "@/server/storage/index.js";
import { createDatabaseAdapter } from "@/server/storage/database-adapter.js";
import { readFile } from "@/server/storage/files-service.js";
import { createBusiness } from "@/server/businesses/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { getApprovedContext } from "@/server/businesses/context-service.js";
import { saveBusinessProfile } from "@/server/businesses/profile-service.js";
import { businessProfileSchema } from "@/validation/profile.js";
import { brandEngine, createBrandProject, listBrandProjects } from "@/modules/brand/service.js";
import { approveIdentity, getCurrentIdentity, getIdentityOverview } from "@/modules/brand/identity-service.js";
import { deleteBrandAsset, listBrandAssets, uploadBrandAsset } from "@/modules/brand/assets-service.js";
import { BRAND_SECTIONS } from "@/modules/brand/sections.js";
import { addMember, createUser } from "../helpers/factories.js";

let prompts;
beforeEach(() => {
  prompts = [];
  setProviderOverrides({ text: createMockTextProvider({ responder: (req) => (prompts.push(req), mockFixtureResponder(req)) }) });
});
afterEach(() => setProviderOverrides(null));

async function setup() {
  const owner = await createUser();
  const biz = await createBusiness(owner.user, owner.workspace.id, { name: "Crumb & Co", industry: "Bakery", stage: "STARTING" });
  const project = await createBrandProject(owner.user, owner.workspace.id, { businessId: biz.id, styleKeywords: ["friendly", "organic"], avoid: "neon colours" });
  return { owner, biz, project, ws: owner.workspace.id };
}
const gen = (ctx, section, opts) => brandEngine.generateSection(ctx.owner.user, ctx.ws, ctx.project.id, section, opts);

describe("brand projects", () => {
  it("requires an existing business in the same workspace", async () => {
    const { owner, biz } = await setup();
    const other = await createUser();
    await expect(createBrandProject(other.user, other.workspace.id, { businessId: biz.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listBrandProjects(owner.user, owner.workspace.id)).toHaveLength(1);
  });
});

describe("brand sections", () => {
  it("generates all sections; later prompts receive only the selected option", async () => {
    const ctx = await setup();
    for (const s of BRAND_SECTIONS) await gen(ctx, s.key);
    const detail = await brandEngine.getProject(ctx.owner.user, ctx.ws, ctx.project.id);
    const palettes = detail.sections.palettes.active;
    await brandEngine.updateSectionState(ctx.owner.user, ctx.ws, ctx.project.id, "palettes", palettes.id, { selected: 1 });
    await gen(ctx, "typography");
    const prompt = prompts.at(-1).prompt;
    expect(prompt).toContain('"name":"Flour"');
    expect(prompt).not.toContain('"name":"Crust"');
    expect(prompt).toContain("Style: friendly, organic");
    expect(prompt).toContain("Avoid: neon colours");
    expect(prompt).toContain("Name: Crumb & Co");
  });

  it("normalizes colours and repairs invalid logo icons", async () => {
    const ctx = await setup();
    const out = await gen(ctx, "palettes");
    expect(out.content.palettes[0].colors.primary).toBe("#7a4b2a");
    setProviderOverrides({
      text: createMockTextProvider({
        responder: (req) => {
          const data = mockFixtureResponder(req).data;
          data.concepts[0] = { ...data.concepts[0], icon: "NotARealIcon", fontWeight: "900", letterSpacing: 5, colors: { mark: "ABC", markForeground: "#ffffff", text: "#000" } };
          return { data };
        },
      }),
    });
    const logos = await gen(ctx, "logo_concepts");
    expect(logos.content.concepts[0]).toMatchObject({ markType: "monogram", icon: "", fontWeight: "900", letterSpacing: 0.3, colors: { mark: "#aabbcc", text: "#000000" } });
    // Playfair has 900; Pacifico only 400.
    expect(logos.content.concepts[2].fontWeight).toBe("400");
  });

  it("rejects AI output with invalid colours and user edits with invalid colours", async () => {
    const ctx = await setup();
    setProviderOverrides({ text: createMockTextProvider({ responder: (req) => { const d = mockFixtureResponder(req).data; d.palettes[0].colors.primary = "brown"; return { data: d }; } }) });
    await expect(gen(ctx, "palettes")).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
    setProviderOverrides({ text: createMockTextProvider({ responder: mockFixtureResponder }) });
    const out = await gen(ctx, "palettes");
    const bad = structuredClone(out.content);
    bad.palettes[0].colors.accent = "not-a-colour";
    await expect(brandEngine.editSection(ctx.owner.user, ctx.ws, ctx.project.id, "palettes", bad)).rejects.toMatchObject({ code: "VALIDATION_ERROR", details: { "palettes.0.colors.accent": expect.any(Array) } });
  });

  it("validates selections and keeps them on edits", async () => {
    const ctx = await setup();
    const out = await gen(ctx, "logo_concepts");
    await expect(brandEngine.updateSectionState(ctx.owner.user, ctx.ws, ctx.project.id, "logo_concepts", out.id, { selected: 9 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(brandEngine.updateSectionState(ctx.owner.user, ctx.ws, ctx.project.id, "personality", out.id, { selected: 0 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const edited = await brandEngine.editSection(ctx.owner.user, ctx.ws, ctx.project.id, "logo_concepts", out.content, undefined, { state: { selected: 2 } });
    expect(edited.state).toEqual({ selected: 2 });
  });
});

describe("brand identity approval", () => {
  it("refuses to approve an incomplete identity", async () => {
    const ctx = await setup();
    await gen(ctx, "personality");
    await expect(approveIdentity(ctx.owner.user, ctx.ws, ctx.project.id)).rejects.toMatchObject({ code: "CONFLICT", details: { missing: expect.arrayContaining(["Brand voice", "Logo"]) } });
  });

  it("approves a versioned identity and publishes brand context without losing the profile", async () => {
    const ctx = await setup();
    // An approved profile exists first.
    await saveBusinessProfile(ctx.owner.user, ctx.ws, ctx.biz.id, businessProfileSchema.parse({ name: "Crumb & Co", stage: "STARTING", products: [{ name: "Sourdough" }] }));
    const { approveContextDraft } = await import("@/server/businesses/context-service.js");
    await approveContextDraft(ctx.owner.user, ctx.ws, ctx.biz.id, { sections: ["basics", "offering"] });

    for (const s of BRAND_SECTIONS) await gen(ctx, s.key);
    const tag = (await brandEngine.getProject(ctx.owner.user, ctx.ws, ctx.project.id)).sections.taglines.active;
    await brandEngine.updateSectionState(ctx.owner.user, ctx.ws, ctx.project.id, "taglines", tag.id, { selected: 1 });

    const overview = await getIdentityOverview(ctx.owner.user, ctx.ws, ctx.project.id);
    expect(overview.draft.complete).toBe(true);
    expect(overview.draft.data.tagline).toBe("Your neighbourhood loaf");

    const v1 = await approveIdentity(ctx.owner.user, ctx.ws, ctx.project.id);
    const v2 = await approveIdentity(ctx.owner.user, ctx.ws, ctx.project.id);
    expect([v1.version, v2.version]).toEqual([1, 2]);
    expect(await prisma.brandIdentity.count({ where: { businessId: ctx.biz.id, status: "APPROVED" } })).toBe(1);

    const scope = await requireWorkspaceAccess(ctx.owner.user, ctx.ws);
    const context = await getApprovedContext(scope, ctx.biz.id);
    expect(Object.keys(context.data).sort()).toEqual(["basics", "brandIdentity", "brandVoice", "offering"]);
    expect(context.data.brandIdentity).toMatchObject({ tagline: "Your neighbourhood loaf", typography: { heading: "Playfair Display 700", body: "Inter 400" } });
    expect(context.data.brandVoice.preferredWords).toEqual(["fresh", "crafted"]);

    // A later profile save keeps the brand sections in the new draft.
    await saveBusinessProfile(ctx.owner.user, ctx.ws, ctx.biz.id, businessProfileSchema.parse({ name: "Crumb & Co", stage: "OPERATING" }));
    const draft = await prisma.businessContextVersion.findFirst({ where: { businessId: ctx.biz.id, status: "DRAFT" } });
    expect(Object.keys(draft.data)).toEqual(expect.arrayContaining(["brandIdentity", "brandVoice", "basics"]));

    // Later AI calls for this business receive the brand context.
    await gen(ctx, "guidelines");
    expect(prompts.at(-1).prompt).toContain('"brandVoice"');

    const current = await getCurrentIdentity(ctx.owner.user, ctx.ws, ctx.biz.id);
    expect(current.identity.version).toBe(2);
  });

  it("only admins/owners can approve", async () => {
    const ctx = await setup();
    for (const s of BRAND_SECTIONS) await gen(ctx, s.key);
    const editor = await createUser();
    await addMember(ctx.ws, editor.user.id, "EDITOR");
    await expect(approveIdentity(editor.user, ctx.ws, ctx.project.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("hides identities from other workspaces", async () => {
    const ctx = await setup();
    const other = await createUser();
    await expect(getCurrentIdentity(other.user, other.workspace.id, ctx.biz.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getIdentityOverview(other.user, other.workspace.id, ctx.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("brand asset library (database storage)", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);

  it("stores files in MySQL, lists, serves and deletes them", async () => {
    setStorageAdapter(createDatabaseAdapter(prisma));
    const ctx = await setup();
    const asset = await uploadBrandAsset(ctx.owner.user, ctx.ws, ctx.biz.id, { buffer: png, originalName: "logo.png", meta: { name: "Old logo", kind: "LOGO" } });
    expect(asset).toMatchObject({ name: "Old logo", kind: "LOGO", storedFile: { mimeType: "image/png", sizeBytes: 72 } });
    expect(await prisma.storageObject.count()).toBe(1);

    const { body } = await readFile(ctx.owner.user, ctx.ws, asset.storedFile.id);
    expect(Buffer.compare(body, png)).toBe(0);
    expect(await listBrandAssets(ctx.owner.user, ctx.ws, ctx.biz.id)).toHaveLength(1);

    const other = await createUser();
    await expect(readFile(other.user, other.workspace.id, asset.storedFile.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteBrandAsset(other.user, other.workspace.id, ctx.biz.id, asset.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    await deleteBrandAsset(ctx.owner.user, ctx.ws, ctx.biz.id, asset.id);
    expect(await listBrandAssets(ctx.owner.user, ctx.ws, ctx.biz.id)).toEqual([]);
    expect(await prisma.storageObject.count()).toBe(0);
  });

  it("enforces the 5 MB database-storage limit and file types", async () => {
    setStorageAdapter(createDatabaseAdapter(prisma));
    const ctx = await setup();
    const big = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]);
    await expect(uploadBrandAsset(ctx.owner.user, ctx.ws, ctx.biz.id, { buffer: big, originalName: "big.png", meta: { name: "Big", kind: "IMAGE" } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(uploadBrandAsset(ctx.owner.user, ctx.ws, ctx.biz.id, { buffer: Buffer.from("<svg/>"), originalName: "x.svg", meta: { name: "X", kind: "LOGO" } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await prisma.brandAsset.count()).toBe(0);
  });

  it("does not let viewers upload", async () => {
    setStorageAdapter(createDatabaseAdapter(prisma));
    const ctx = await setup();
    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    await expect(uploadBrandAsset(viewer.user, ctx.ws, ctx.biz.id, { buffer: png, originalName: "a.png", meta: { name: "A", kind: "IMAGE" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
