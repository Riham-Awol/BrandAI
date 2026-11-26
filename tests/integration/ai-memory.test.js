import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { clearAiMemory, deleteAiExample, getAiMemory, setAiLearning } from "@/server/ai/memory.js";
import { acceptSectionVersion, createLaunchProject, editSection, generateSection } from "@/modules/launch/service.js";
import { createSocialProject } from "@/modules/social/service.js";
import { createSocialProjectSchema } from "@/modules/social/schemas.js";
import { createPost, updatePost } from "@/modules/social/posts-service.js";
import { createBusiness } from "@/server/businesses/service.js";
import "@/modules/launch/mock-fixtures.js";
import { addMember, createUser } from "../helpers/factories.js";

const IDEA = { idea: "A neighbourhood sourdough bakery that also supplies local cafés.", country: "United Kingdom", city: "Leeds", stage: "IDEA", budget: "10k_50k", businessName: "Crumb" };
let prompts;
// A provider that is NOT flagged as mock (mock outputs are never learned from), with fixture data.
beforeEach(() => {
  prompts = [];
  setProviderOverrides({
    text: {
      name: "test", isMock: false,
      async generate(request) {
        prompts.push(request.prompt);
        const r = mockFixtureResponder(request);
        return { data: r.data, text: r.text ?? JSON.stringify(r.data), model: "test-model", usage: { inputTokens: 10, outputTokens: 10 } };
      },
    },
  });
});
afterEach(() => setProviderOverrides(null));

describe("learning from approvals", () => {
  it("an accepted studio result is reused as an example for the same business and task", async () => {
    const owner = await createUser();
    const ws = owner.workspace.id;
    const project = await createLaunchProject(owner.user, ws, IDEA);
    const first = await generateSection(owner.user, ws, project.id, "names");
    expect(prompts[0]).not.toContain("<approved_examples>");

    // Edited then accepted → remembered as "edited, then approved".
    const edited = await editSection(owner.user, ws, project.id, "names", { ...(await prisma.projectOutput.findUnique({ where: { id: first.id } })).content });
    await acceptSectionVersion(owner.user, ws, project.id, "names", edited.id);
    const memory = await getAiMemory(owner.user, ws);
    expect(memory.examples).toHaveLength(1);
    expect(memory.examples[0]).toMatchObject({ module: "launch", task: "names", source: "EDITED", label: "Launch · Names" });

    await generateSection(owner.user, ws, project.id, "names");
    expect(prompts[1]).toContain("<approved_examples>");
    expect(prompts[1]).toContain('edited_by_the_business="true"');
    const gen = await prisma.aiGeneration.findFirst({ where: { workspaceId: ws, task: "names" }, orderBy: { createdAt: "desc" } });
    expect(gen.input.examplesUsed).toEqual([memory.examples[0].id]);

    // Accepting another version of the same section replaces the example (one per project section).
    const again = await generateSection(owner.user, ws, project.id, "names");
    await acceptSectionVersion(owner.user, ws, project.id, "names", again.id);
    expect((await getAiMemory(owner.user, ws)).examples).toMatchObject([{ source: "APPROVED" }]);

    // Other tasks don't receive these examples.
    const before = prompts.length;
    await generateSection(owner.user, ws, project.id, "idea_analysis");
    expect(prompts).toHaveLength(before + 1);
    expect(prompts.at(-1)).not.toContain("<approved_examples>");
  });

  it("mock outputs are never learned; switching learning off stops saving and using examples", async () => {
    const owner = await createUser();
    const ws = owner.workspace.id;
    const project = await createLaunchProject(owner.user, ws, IDEA);
    const v = await generateSection(owner.user, ws, project.id, "names");
    await prisma.projectOutput.update({ where: { id: v.id }, data: { isMock: true } });
    await acceptSectionVersion(owner.user, ws, project.id, "names", v.id);
    expect((await getAiMemory(owner.user, ws)).examples).toEqual([]);

    const real = await generateSection(owner.user, ws, project.id, "names");
    await acceptSectionVersion(owner.user, ws, project.id, "names", real.id);
    expect((await getAiMemory(owner.user, ws)).examples).toHaveLength(1);
    await setAiLearning(owner.user, ws, { enabled: false });
    await generateSection(owner.user, ws, project.id, "names");
    expect(prompts.at(-1)).not.toContain("<approved_examples>");
    expect((await getAiMemory(owner.user, ws)).enabled).toBe(false);
  });

  it("social posts marked ready teach the AI; moving them back forgets them", async () => {
    const owner = await createUser();
    const ws = owner.workspace.id;
    const biz = await createBusiness(owner.user, ws, { name: "Crust & Culture", industry: "Bakery", stage: "STARTING" });
    const project = await createSocialProject(owner.user, ws, createSocialProjectSchema.parse({ businessId: biz.id, month: "2027-02", platforms: ["INSTAGRAM"], postsPerWeek: 3, focus: "Sourdough" }));
    const post = await createPost(owner.user, ws, project.id, { date: "2027-02-10", platform: "INSTAGRAM", format: "POST", title: "Rye", generate: true });
    await updatePost(owner.user, ws, project.id, post.id, { status: "READY" });
    expect((await getAiMemory(owner.user, ws)).examples).toMatchObject([{ module: "social", task: "posts", source: "APPROVED" }]);
    await updatePost(owner.user, ws, project.id, post.id, { status: "DRAFT" });
    expect((await getAiMemory(owner.user, ws)).examples).toEqual([]);
  });

  it("permissions and workspace isolation", async () => {
    const owner = await createUser();
    const ws = owner.workspace.id;
    const project = await createLaunchProject(owner.user, ws, IDEA);
    const v = await generateSection(owner.user, ws, project.id, "names");
    await acceptSectionVersion(owner.user, ws, project.id, "names", v.id);
    const [example] = (await getAiMemory(owner.user, ws)).examples;

    const viewer = await createUser();
    await addMember(ws, viewer.user.id, "VIEWER");
    expect((await getAiMemory(viewer.user, ws)).permissions).toEqual({ canEdit: false, canToggle: false });
    await expect(deleteAiExample(viewer.user, ws, example.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setAiLearning(viewer.user, ws, { enabled: false })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const other = await createUser();
    await expect(getAiMemory(other.user, ws)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteAiExample(other.user, other.workspace.id, example.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await clearAiMemory(other.user, other.workspace.id, {})).toEqual({ deleted: 0 });
    expect((await getAiMemory(owner.user, ws)).examples).toHaveLength(1);

    expect(await deleteAiExample(owner.user, ws, example.id)).toEqual({ deleted: true });
    expect((await getAiMemory(owner.user, ws)).examples).toEqual([]);
  });
});
