import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { prisma } from "@/server/db/prisma.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { createBusiness } from "@/server/businesses/service.js";
import { approveContextDraft, saveContextDraft } from "@/server/businesses/context-service.js";
import { addMember, createUser } from "../helpers/factories.js";

const NameIdeas = z.object({ names: z.array(z.string()).min(1) });

afterEach(() => setProviderOverrides(null));

describe("AI orchestrator", () => {
  it("injects approved context, validates output and records generation + usage", async () => {
    let seen;
    setProviderOverrides({
      text: createMockTextProvider({
        responder: (req) => {
          seen = req;
          return { data: { names: ["Bloom & Crumb"] } };
        },
      }),
    });
    const { user, workspace } = await createUser();
    const biz = await createBusiness(user, workspace.id, { name: "Bloom", stage: "IDEA" });
    await saveContextDraft(user, workspace.id, biz.id, { data: { basics: { name: "Bloom" }, goals: { secretPlan: "hidden" } } });
    await approveContextDraft(user, workspace.id, biz.id, { sections: ["basics"] });

    const result = await generateText({
      user, workspaceId: workspace.id, businessId: biz.id, module: "test", task: "names",
      instructions: "Suggest names.", input: "bakery", schema: NameIdeas,
    });

    expect(result.data).toEqual({ names: ["Bloom & Crumb"] });
    expect(result.isMock).toBe(true);
    expect(seen.prompt).toContain("<business_context");
    expect(seen.prompt).toContain('"name": "Bloom"');
    expect(seen.prompt).not.toContain("secretPlan");
    expect(seen.prompt).toContain("<user_input>\nbakery\n</user_input>");

    const gen = await prisma.aiGeneration.findUnique({ where: { id: result.generationId } });
    expect(gen).toMatchObject({ status: "SUCCEEDED", module: "test", task: "names", businessId: biz.id });
    expect(gen.contextVersionId).not.toBeNull();
    expect(gen.output.isMock).toBe(true);
    expect(await prisma.aiUsageRecord.count({ where: { generationId: gen.id, workspaceId: workspace.id } })).toBe(1);
  });

  it("marks the generation FAILED when the output does not match the schema", async () => {
    setProviderOverrides({ text: createMockTextProvider({ responder: () => ({ data: { wrong: true } }) }) });
    const { user, workspace } = await createUser();
    await expect(
      generateText({ user, workspaceId: workspace.id, module: "test", task: "names", input: "x", schema: NameIdeas }),
    ).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
    const gen = await prisma.aiGeneration.findFirst({ where: { workspaceId: workspace.id } });
    expect(gen).toMatchObject({ status: "FAILED", errorCode: "AI_INVALID_OUTPUT" });
  });

  it("enforces workspace usage limits", async () => {
    setProviderOverrides({ text: createMockTextProvider() });
    const { user, workspace } = await createUser();
    await prisma.usageLimit.update({
      where: { workspaceId_metric_period: { workspaceId: workspace.id, metric: "AI_TEXT_REQUESTS", period: "MONTHLY" } },
      data: { limitValue: 1n },
    });
    await generateText({ user, workspaceId: workspace.id, module: "t", task: "t", input: "a" });
    await expect(generateText({ user, workspaceId: workspace.id, module: "t", task: "t", input: "b" })).rejects.toMatchObject({ code: "USAGE_LIMIT_REACHED", status: 402 });
  });

  it("denies viewers and non-members", async () => {
    setProviderOverrides({ text: createMockTextProvider() });
    const owner = await createUser();
    const viewer = await createUser();
    const stranger = await createUser();
    await addMember(owner.workspace.id, viewer.user.id, "VIEWER");
    await expect(generateText({ user: viewer.user, workspaceId: owner.workspace.id, module: "t", task: "t", input: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(generateText({ user: stranger.user, workspaceId: owner.workspace.id, module: "t", task: "t", input: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.aiGeneration.count()).toBe(0);
  });

  it("reports SERVICE_NOT_CONFIGURED when the real provider has no API key", async () => {
    const { createAnthropicTextProvider } = await import("@/server/ai/providers/anthropic.js");
    setProviderOverrides({ text: createAnthropicTextProvider({ apiKey: undefined, defaultModel: "claude-opus-5-5" }) });
    const { user, workspace } = await createUser();
    await expect(generateText({ user, workspaceId: workspace.id, module: "t", task: "t", input: "x" })).rejects.toMatchObject({ code: "SERVICE_NOT_CONFIGURED", status: 503 });
  });
});
