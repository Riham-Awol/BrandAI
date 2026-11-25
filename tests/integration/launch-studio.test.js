import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import {
  acceptSectionVersion, createLaunchProject, deleteLaunchProject, editSection, exportLaunchPack,
  generateSection, getLaunchProject, getSectionVersion, listLaunchProjects, updateChecklistProgress,
} from "@/modules/launch/service.js";
import { getProfileDraftForProject } from "@/modules/launch/profile-draft.js";
import { saveBusinessProfile, getBusinessProfile } from "@/server/businesses/profile-service.js";
import { approveContextDraft, getApprovedContext } from "@/server/businesses/context-service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { createBusiness } from "@/server/businesses/service.js";
import { businessProfileSchema } from "@/validation/profile.js";
import { LAUNCH_SECTIONS } from "@/modules/launch/sections.js";
import { addMember, createUser, setPlan } from "../helpers/factories.js";

const IDEA = { idea: "A neighbourhood sourdough bakery that also supplies local cafés.", country: "United Kingdom", city: "Leeds", stage: "IDEA", budget: "10k_50k" };

let prompts;
beforeEach(() => {
  prompts = [];
  setProviderOverrides({
    text: createMockTextProvider({
      responder: (req) => {
        prompts.push(req);
        return mockFixtureResponder(req);
      },
    }),
  });
});
afterEach(() => setProviderOverrides(null));

async function setup() {
  const owner = await createUser();
  await setPlan(owner.workspace.id, "PRO"); // these scenarios use several businesses/websites
  const project = await createLaunchProject(owner.user, owner.workspace.id, { ...IDEA, businessName: "Crumb" });
  return { owner, project };
}

describe("launch projects", () => {
  it("creates a business and a project from an idea", async () => {
    const { owner, project } = await setup();
    const biz = await prisma.business.findUnique({ where: { id: project.businessId } });
    expect(biz).toMatchObject({ name: "Crumb", workspaceId: owner.workspace.id, stage: "IDEA" });
    const list = await listLaunchProjects(owner.user, owner.workspace.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ completedSections: 0, totalSections: 10 });
  });

  it("can attach to an existing business in the same workspace only", async () => {
    const a = await createUser();
    const b = await createUser();
    const biz = await createBusiness(a.user, a.workspace.id, { name: "Existing", stage: "OPERATING" });
    const p = await createLaunchProject(a.user, a.workspace.id, { ...IDEA, businessId: biz.id });
    expect(p.businessId).toBe(biz.id);
    await expect(createLaunchProject(b.user, b.workspace.id, { ...IDEA, businessId: biz.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.business.count()).toBe(1);
  });

  it("soft-deletes projects", async () => {
    const { owner, project } = await setup();
    await deleteLaunchProject(owner.user, owner.workspace.id, project.id);
    expect(await listLaunchProjects(owner.user, owner.workspace.id)).toEqual([]);
    await expect(getLaunchProject(owner.user, owner.workspace.id, project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("section generation", () => {
  it("generates every section with structured output and feeds earlier results forward", async () => {
    const { owner, project } = await setup();
    for (const s of LAUNCH_SECTIONS) {
      const out = await generateSection(owner.user, owner.workspace.id, project.id, s.key);
      expect(out).toMatchObject({ version: 1, source: "AI", isMock: true });
    }
    const planPrompt = prompts.find((p) => p.task === "business_plan").prompt;
    expect(planPrompt).toContain('<previous_result section="strategy">');
    expect(planPrompt).toContain("Leeds, United Kingdom");
    expect(prompts.find((p) => p.task === "idea_analysis").prompt).not.toContain("previous_result");

    const detail = await getLaunchProject(owner.user, owner.workspace.id, project.id);
    expect(Object.values(detail.sections).every((s) => s.active)).toBe(true);
    expect(await prisma.aiUsageRecord.count({ where: { workspaceId: owner.workspace.id } })).toBe(10);
    const gens = await prisma.aiGeneration.findMany({ where: { workspaceId: owner.workspace.id } });
    expect(gens.every((g) => g.module === "launch" && g.status === "SUCCEEDED" && g.businessId === project.businessId)).toBe(true);
  });

  it("regenerates with revision instructions as a new version, keeping history", async () => {
    const { owner, project } = await setup();
    await generateSection(owner.user, owner.workspace.id, project.id, "names");
    const v2 = await generateSection(owner.user, owner.workspace.id, project.id, "names", { feedback: "Shorter, more playful names" });
    expect(v2.version).toBe(2);
    const last = prompts.at(-1).prompt;
    expect(last).toContain("<revision_request>\nShorter, more playful names");
    expect(last).toContain("<current_version>");
    const detail = await getLaunchProject(owner.user, owner.workspace.id, project.id);
    expect(detail.sections.names.versions.map((v) => v.version)).toEqual([2, 1]);
  });

  it("rejects unknown sections and invalid AI output", async () => {
    const { owner, project } = await setup();
    await expect(generateSection(owner.user, owner.workspace.id, project.id, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    setProviderOverrides({ text: createMockTextProvider({ responder: () => ({ data: { wrong: 1 } }) }) });
    await expect(generateSection(owner.user, owner.workspace.id, project.id, "names")).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
    expect(await prisma.projectOutput.count()).toBe(0);
  });

  it("reports missing AI credentials without creating outputs", async () => {
    const { createAnthropicTextProvider } = await import("@/server/ai/providers/anthropic.js");
    setProviderOverrides({ text: createAnthropicTextProvider({ apiKey: undefined, defaultModel: "claude-opus-5-5" }) });
    const { owner, project } = await setup();
    await expect(generateSection(owner.user, owner.workspace.id, project.id, "names")).rejects.toMatchObject({ code: "SERVICE_NOT_CONFIGURED" });
    expect(await prisma.projectOutput.count()).toBe(0);
  });
});

describe("editing, versions and acceptance", () => {
  it("validates edits against the section schema and stores them as new versions", async () => {
    const { owner, project } = await setup();
    const v1 = await generateSection(owner.user, owner.workspace.id, project.id, "industry");
    await expect(editSection(owner.user, owner.workspace.id, project.id, "industry", { primaryIndustry: 5 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const edited = await editSection(owner.user, owner.workspace.id, project.id, "industry", { ...v1.content, primaryIndustry: "Artisan Food" });
    expect(edited).toMatchObject({ version: 2, source: "EDIT" });
    const old = await getSectionVersion(owner.user, owner.workspace.id, project.id, "industry", v1.id);
    expect(old.content.primaryIndustry).toBe("Food & Beverage");
  });

  it("uses the accepted version as the active one and for later sections", async () => {
    const { owner, project } = await setup();
    const v1 = await generateSection(owner.user, owner.workspace.id, project.id, "industry");
    await editSection(owner.user, owner.workspace.id, project.id, "industry", { ...v1.content, primaryIndustry: "EDITED" });
    await acceptSectionVersion(owner.user, owner.workspace.id, project.id, "industry", v1.id);
    const detail = await getLaunchProject(owner.user, owner.workspace.id, project.id);
    expect(detail.sections.industry.active).toMatchObject({ id: v1.id, isAccepted: true });
    await generateSection(owner.user, owner.workspace.id, project.id, "audience");
    expect(prompts.at(-1).prompt).toContain('"primaryIndustry":"Food & Beverage"');
    expect(prompts.at(-1).prompt).not.toContain("EDITED");
  });

  it("tracks checklist progress and rejects unknown items", async () => {
    const { owner, project } = await setup();
    const out = await generateSection(owner.user, owner.workspace.id, project.id, "launch_checklist");
    const r = await updateChecklistProgress(owner.user, owner.workspace.id, project.id, out.id, ["0-0", "1-0", "0-0"]);
    expect(r).toMatchObject({ state: { completed: ["0-0", "1-0"] }, total: 3 });
    await expect(updateChecklistProgress(owner.user, owner.workspace.id, project.id, out.id, ["9-9"])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("exports a Markdown launch pack", async () => {
    const { owner, project } = await setup();
    await generateSection(owner.user, owner.workspace.id, project.id, "idea_analysis");
    const { filename, markdown } = await exportLaunchPack(owner.user, owner.workspace.id, project.id);
    expect(filename).toBe("crumb-launch-pack.md");
    expect(markdown).toContain("# Crumb — Launch Pack");
    expect(markdown).toContain("## Idea analysis");
    expect(markdown).toContain("mock AI provider");
  });
});

describe("permissions and isolation", () => {
  it("lets viewers read but not generate, edit or accept", async () => {
    const { owner, project } = await setup();
    const out = await generateSection(owner.user, owner.workspace.id, project.id, "names");
    const viewer = await createUser();
    await addMember(owner.workspace.id, viewer.user.id, "VIEWER");
    const detail = await getLaunchProject(viewer.user, owner.workspace.id, project.id);
    expect(detail.permissions).toMatchObject({ canEdit: false, canGenerate: false });
    await expect(generateSection(viewer.user, owner.workspace.id, project.id, "names")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(editSection(viewer.user, owner.workspace.id, project.id, "names", out.content)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(acceptSectionVersion(viewer.user, owner.workspace.id, project.id, "names", out.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("hides projects, versions and profiles from other workspaces", async () => {
    const { owner, project } = await setup();
    const out = await generateSection(owner.user, owner.workspace.id, project.id, "names");
    const other = await createUser();
    await expect(getLaunchProject(other.user, other.workspace.id, project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getSectionVersion(other.user, other.workspace.id, project.id, "names", out.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(generateSection(other.user, other.workspace.id, project.id, "names")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getBusinessProfile(other.user, other.workspace.id, project.businessId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listLaunchProjects(other.user, other.workspace.id)).toEqual([]);
  });

  it("will not accept a version from another project", async () => {
    const { owner, project } = await setup();
    const p2 = await createLaunchProject(owner.user, owner.workspace.id, IDEA);
    const foreign = await generateSection(owner.user, owner.workspace.id, p2.id, "names");
    await expect(acceptSectionVersion(owner.user, owner.workspace.id, project.id, "names", foreign.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("business profile from launch outputs", () => {
  it("pre-fills, saves structured tables and feeds the approved context", async () => {
    const { owner, project } = await setup();
    for (const key of ["idea_analysis", "names", "industry", "audience", "problems", "competitors", "business_model", "strategy"]) {
      await generateSection(owner.user, owner.workspace.id, project.id, key);
    }
    const draft = await getProfileDraftForProject(owner.user, owner.workspace.id, project.id);
    expect(draft.profile).toMatchObject({ name: "Crumb", industry: "Food & Beverage" });
    expect(draft.profile.products.map((p) => p.name)).toEqual(["Sourdough loaf"]);
    expect(draft.profile.services.map((p) => p.name)).toEqual(["Café supply"]);
    expect(draft.profile.locations[0]).toMatchObject({ city: "Leeds", country: "United Kingdom", isPrimary: true });

    const profile = businessProfileSchema.parse(draft.profile);
    const saved = await saveBusinessProfile(owner.user, owner.workspace.id, project.businessId, profile);
    expect(saved.profile.audiences[0]).toMatchObject({ name: "Young professionals", isPrimary: true });
    expect(await prisma.competitor.count({ where: { businessId: project.businessId } })).toBe(1);
    expect(await prisma.businessGoal.count({ where: { businessId: project.businessId } })).toBe(1);

    await approveContextDraft(owner.user, owner.workspace.id, project.businessId, { sections: ["basics", "offering", "audience"] });
    const scope = await requireWorkspaceAccess(owner.user, owner.workspace.id);
    const ctx = await getApprovedContext(scope, project.businessId);
    expect(Object.keys(ctx.data).sort()).toEqual(["audience", "basics", "offering"]);
    expect(ctx.data.basics.name).toBe("Crumb");

    // Re-saving replaces lists rather than duplicating them.
    await saveBusinessProfile(owner.user, owner.workspace.id, project.businessId, { ...profile, competitors: [] });
    expect(await prisma.competitor.count({ where: { businessId: project.businessId } })).toBe(0);
    expect(await prisma.businessProduct.count({ where: { businessId: project.businessId } })).toBe(1);
  });

  it("keeps only one primary location/audience", async () => {
    const owner = await createUser();
    const biz = await createBusiness(owner.user, owner.workspace.id, { name: "Multi", stage: "OPERATING" });
    const profile = businessProfileSchema.parse({
      name: "Multi", stage: "OPERATING",
      locations: [{ country: "Kenya", isPrimary: true }, { country: "Ghana", isPrimary: true }],
      audiences: [{ name: "A", isPrimary: true }, { name: "B", isPrimary: true }],
    });
    const { profile: saved } = await saveBusinessProfile(owner.user, owner.workspace.id, biz.id, profile);
    expect(saved.locations.filter((l) => l.isPrimary)).toHaveLength(1);
    expect(saved.audiences.filter((a) => a.isPrimary)).toHaveLength(1);
  });

  it("requires edit permission to save a profile", async () => {
    const owner = await createUser();
    const viewer = await createUser();
    await addMember(owner.workspace.id, viewer.user.id, "VIEWER");
    const biz = await createBusiness(owner.user, owner.workspace.id, { name: "P", stage: "IDEA" });
    await expect(saveBusinessProfile(viewer.user, owner.workspace.id, biz.id, businessProfileSchema.parse({ name: "X", stage: "IDEA" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
