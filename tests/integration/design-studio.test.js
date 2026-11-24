import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { setStorageAdapter } from "@/server/storage/index.js";
import { createDatabaseAdapter } from "@/server/storage/database-adapter.js";
import { createBusiness } from "@/server/businesses/service.js";
import "@/modules/brand/mock-fixtures.js";
import { uploadBrandAsset } from "@/modules/brand/assets-service.js";
import { createSocialProject } from "@/modules/social/service.js";
import { createSocialProjectSchema } from "@/modules/social/schemas.js";
import { createPost } from "@/modules/social/posts-service.js";
import {
  deleteDesign, duplicateDesign, generateDesignOptions, getDesign, getPostPrefill, listDesignImages, listDesigns,
  previewDesign, renderDesign, restoreRevision, saveDesign, updateDesign,
} from "@/modules/design/service.js";
import { designBriefSchema, saveDesignSchema } from "@/modules/design/schemas.js";
import { DESIGN_OPTIONS_FIXTURE } from "@/modules/design/mock-fixtures.js";
import { addMember, createUser } from "../helpers/factories.js";

let prompts;
beforeEach(() => {
  prompts = [];
  setProviderOverrides({ text: createMockTextProvider({ responder: (req) => (prompts.push(req), mockFixtureResponder(req)) }) });
  setStorageAdapter(createDatabaseAdapter(prisma));
});
afterEach(() => setProviderOverrides(null));

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(32, 1)]);
const spec = DESIGN_OPTIONS_FIXTURE.options[0];

async function setup() {
  const owner = await createUser();
  const ws = owner.workspace.id;
  const biz = await createBusiness(owner.user, ws, { name: "Crust & Culture", industry: "Bakery", stage: "STARTING" });
  return { owner, ws, biz };
}

async function approveBrand(ctx) {
  const concept = mockFixtureResponder({ module: "brand", task: "logo_concepts" }).data.concepts[0];
  const palette = mockFixtureResponder({ module: "brand", task: "palettes" }).data.palettes[0];
  await prisma.brandIdentity.create({
    data: {
      workspaceId: ctx.ws, businessId: ctx.biz.id, version: 1, createdById: ctx.owner.user.id, approvedById: ctx.owner.user.id,
      data: { businessName: "Crust & Culture", logo: concept, palette: { name: palette.name, colors: palette.colors }, typography: { heading: { fontKey: "fraunces", weight: "700" }, body: { fontKey: "manrope", weight: "500" } } },
    },
  });
  return palette;
}

const brief = (ctx, over = {}) => designBriefSchema.parse({ businessId: ctx.biz.id, kind: "POSTER", format: "a4_portrait", brief: "Poster for our new rye loaf launch on Saturday", details: "Date: Sat 14 March", ...over });
const save = (ctx, over = {}) => saveDesign(ctx.owner.user, ctx.ws, saveDesignSchema.parse({ businessId: ctx.biz.id, kind: "POSTER", format: "a4_portrait", brief: { brief: "x" }, spec, ...over }));

describe("generating options", () => {
  it("returns three rendered options using the approved brand, with facts in the prompt", async () => {
    const ctx = await setup();
    const palette = await approveBrand(ctx);
    const result = await generateDesignOptions(ctx.owner.user, ctx.ws, brief(ctx));
    expect(result.options).toHaveLength(3);
    expect(result.brandApproved).toBe(true);
    expect(result.isMock).toBe(true);
    expect(result.options.every((o) => o.svg.startsWith("<svg") && o.svg.includes('viewBox="0 0 1240 1754"'))).toBe(true);
    expect(result.options[0].svg.toLowerCase()).toContain(palette.colors.background.toLowerCase());
    expect(result.options[0].svg).toContain("Crust &amp; Culture logo");
    const req = prompts.at(-1);
    expect([req.module, req.task]).toEqual(["design", "options"]);
    expect(req.prompt).toContain("<facts>\nDate: Sat 14 March");
    expect(req.system).toContain("Format: A4 poster (1240×1754px, printed)");
    expect(await prisma.design.count()).toBe(0); // nothing is saved until the user picks one
  });

  it("falls back to a neutral brand when none is approved", async () => {
    const ctx = await setup();
    const result = await generateDesignOptions(ctx.owner.user, ctx.ws, brief(ctx));
    expect(result.brandApproved).toBe(false);
    expect(result.options[0].svg).not.toContain("logo</title>");
  });

  it("rejects sizes that don't belong to the design type", async () => {
    const ctx = await setup();
    await expect(generateDesignOptions(ctx.owner.user, ctx.ws, brief(ctx, { kind: "POSTER", format: "leaderboard" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("uses only image assets of the same business", async () => {
    const ctx = await setup();
    const asset = await uploadBrandAsset(ctx.owner.user, ctx.ws, ctx.biz.id, { buffer: png, originalName: "loaf.png", meta: { name: "Loaf", kind: "IMAGE" } });
    const doc = await uploadBrandAsset(ctx.owner.user, ctx.ws, ctx.biz.id, { buffer: pdf, originalName: "menu.pdf", meta: { name: "Menu", kind: "DOCUMENT" } });
    expect(await listDesignImages(ctx.owner.user, ctx.ws, ctx.biz.id)).toEqual([{ fileId: asset.storedFile.id, name: "Loaf" }]);

    const result = await generateDesignOptions(ctx.owner.user, ctx.ws, brief(ctx, { imageFileId: asset.storedFile.id }));
    expect(result.options.some((o) => o.svg.includes(`href="data:image/png;base64,${png.toString("base64")}"`))).toBe(true);
    expect(prompts.at(-1).system).toContain("A photo is provided");

    await expect(generateDesignOptions(ctx.owner.user, ctx.ws, brief(ctx, { imageFileId: doc.storedFile.id }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const otherBiz = await createBusiness(ctx.owner.user, ctx.ws, { name: "Other", stage: "STARTING" });
    await expect(generateDesignOptions(ctx.owner.user, ctx.ws, brief(ctx, { businessId: otherBiz.id, imageFileId: asset.storedFile.id }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const other = await setup();
    const foreign = await uploadBrandAsset(other.owner.user, other.ws, other.biz.id, { buffer: png, originalName: "x.png", meta: { name: "X", kind: "IMAGE" } });
    await expect(generateDesignOptions(ctx.owner.user, ctx.ws, brief(ctx, { imageFileId: foreign.storedFile.id }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(previewDesign(ctx.owner.user, ctx.ws, { businessId: ctx.biz.id, format: "square", spec, imageFileId: foreign.storedFile.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("saved designs", () => {
  it("saves, edits with revisions, restores, duplicates, renders and deletes", async () => {
    const ctx = await setup();
    await approveBrand(ctx);
    const design = await save(ctx, { isMock: true });
    expect(design).toMatchObject({ version: 1, name: spec.name, isMock: true, permissions: { canEdit: true } });
    expect(design.revisions).toHaveLength(1);

    const edited = await updateDesign(ctx.owner.user, ctx.ws, design.id, { spec: { ...spec, headline: "Rye is here", icon: "wheat" } });
    expect(edited.version).toBe(2);
    expect(edited.spec.icon).toBe("Wheat");
    const resized = await updateDesign(ctx.owner.user, ctx.ws, design.id, { format: "a5_portrait" });
    expect(resized).toMatchObject({ version: 3, format: "a5_portrait" });
    await expect(updateDesign(ctx.owner.user, ctx.ws, design.id, { format: "story" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const restored = await restoreRevision(ctx.owner.user, ctx.ws, design.id, 1);
    expect(restored).toMatchObject({ version: 4, format: "a4_portrait" });
    expect(restored.spec.headline).toBe(spec.headline);
    expect(restored.revisions.map((r) => r.version)).toEqual([4, 3, 2, 1]);

    const rendered = await renderDesign(ctx.owner.user, ctx.ws, design.id);
    expect(rendered.svg).toContain('viewBox="0 0 1240 1754"');
    const asA5 = await renderDesign(ctx.owner.user, ctx.ws, design.id, { format: "a5_portrait" });
    expect(asA5.svg).toContain('viewBox="0 0 874 1240"');

    const copy = await duplicateDesign(ctx.owner.user, ctx.ws, design.id);
    expect(copy.name).toBe(`${spec.name} (copy)`);
    expect(await listDesigns(ctx.owner.user, ctx.ws)).toHaveLength(2);
    await deleteDesign(ctx.owner.user, ctx.ws, design.id);
    expect((await listDesigns(ctx.owner.user, ctx.ws)).map((d) => d.id)).toEqual([copy.id]);
    await expect(getDesign(ctx.owner.user, ctx.ws, design.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("pre-fills a design from a social post (Phase 4 → 5)", async () => {
    const ctx = await setup();
    const project = await createSocialProject(ctx.owner.user, ctx.ws, createSocialProjectSchema.parse({ businessId: ctx.biz.id, month: "2027-02", platforms: ["INSTAGRAM"], postsPerWeek: 3 }));
    const post = await createPost(ctx.owner.user, ctx.ws, project.id, { date: "2027-02-05", platform: "INSTAGRAM", format: "CAROUSEL", title: "Meet the rye", isPromotion: false, generate: true });
    const prefill = await getPostPrefill(ctx.owner.user, ctx.ws, post.id);
    expect(prefill).toMatchObject({ postId: post.id, businessId: ctx.biz.id, kind: "SOCIAL", format: "portrait_4x5", title: "Meet the rye" });
    expect(prefill.brief).toContain("Meet the rye");
    const result = await generateDesignOptions(ctx.owner.user, ctx.ws, brief(ctx, { kind: "SOCIAL", format: "portrait_4x5", sourcePostId: post.id }));
    expect(prompts.at(-1).prompt).toContain("<social_post>");
    const saved = await save(ctx, { kind: "SOCIAL", format: "portrait_4x5", spec: result.options[0].spec, sourcePostId: post.id });
    expect(saved.sourcePostId).toBe(post.id);
  });
});

describe("permissions and isolation", () => {
  it("hides designs from other workspaces and lets viewers only look", async () => {
    const ctx = await setup();
    const design = await save(ctx);
    const other = await createUser();
    await expect(getDesign(other.user, other.workspace.id, design.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getDesign(other.user, ctx.ws, design.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(renderDesign(other.user, other.workspace.id, design.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateDesign(other.user, other.workspace.id, design.id, { name: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteDesign(other.user, other.workspace.id, design.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listDesigns(other.user, other.workspace.id)).toEqual([]);
    await expect(generateDesignOptions(other.user, other.workspace.id, brief(ctx))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(saveDesign(other.user, other.workspace.id, saveDesignSchema.parse({ businessId: ctx.biz.id, kind: "POSTER", format: "a4_portrait", spec }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getDesign(ctx.owner.user, ctx.ws, "not-a-uuid")).rejects.toMatchObject({ code: "NOT_FOUND" });

    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    const seen = await getDesign(viewer.user, ctx.ws, design.id);
    expect(seen.permissions.canEdit).toBe(false);
    await expect(renderDesign(viewer.user, ctx.ws, design.id)).resolves.toMatchObject({ width: 1240 });
    await expect(generateDesignOptions(viewer.user, ctx.ws, brief(ctx))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateDesign(viewer.user, ctx.ws, design.id, { name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteDesign(viewer.user, ctx.ws, design.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(duplicateDesign(viewer.user, ctx.ws, design.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
