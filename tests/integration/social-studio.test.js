import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { createBusiness } from "@/server/businesses/service.js";
import { createSocialProject as createRaw, listSocialProjects, socialEngine } from "@/modules/social/service.js";
import { createSocialProjectSchema } from "@/modules/social/schemas.js";

// Go through the real input schema (defaults such as includePromotions: true).
const createSocialProject = (user, ws, input) => createRaw(user, ws, createSocialProjectSchema.parse(input));
import { createPost, createPostsFromCalendar, deletePost, exportPosts, generatePosts, getPost, listPosts, updatePost } from "@/modules/social/posts-service.js";
import { addMember, createUser } from "../helpers/factories.js";

let prompts;
beforeEach(() => {
  prompts = [];
  setProviderOverrides({ text: createMockTextProvider({ responder: (req) => (prompts.push(req), mockFixtureResponder(req)) }) });
});
afterEach(() => setProviderOverrides(null));

async function setup(settings = {}) {
  const owner = await createUser();
  const biz = await createBusiness(owner.user, owner.workspace.id, { name: "Crust & Culture", industry: "Bakery", stage: "STARTING" });
  const project = await createSocialProject(owner.user, owner.workspace.id, { businessId: biz.id, month: "2027-02", platforms: ["INSTAGRAM", "FACEBOOK"], postsPerWeek: 3, focus: "Valentine's sourdough hearts", ...settings });
  return { owner, biz, project, ws: owner.workspace.id };
}
const gen = (ctx, section) => socialEngine.generateSection(ctx.owner.user, ctx.ws, ctx.project.id, section);

describe("social strategy and calendar", () => {
  it("normalizes pillars and keeps only valid calendar entries for the month and platforms", async () => {
    const ctx = await setup();
    const pillars = await gen(ctx, "pillars");
    expect(pillars.content.pillars.map((p) => p.share)).toEqual([44, 33, 22]);
    expect(pillars.content.hashtagSets[0].hashtags).toEqual(["#sourdough", "#LeedsFood"]);
    const calendar = await gen(ctx, "calendar");
    expect(calendar.content.entries.map((e) => e.title)).toEqual(["Dough at dawn", "Meet our café partners", "Weekend loaf deal", "Which loaf next?"]);
    const calPrompt = prompts.at(-1);
    expect(calPrompt.system).toContain("Plan 12 posts for 2027-02 (days 1-28)");
    expect(calPrompt.prompt).toContain("Focus this month: Valentine's sourdough hearts");
    expect(calPrompt.prompt).toContain('<previous_result section="pillars">');
    expect(await listSocialProjects(ctx.owner.user, ctx.ws)).toHaveLength(1);
  });

  it("drops promotions when they are switched off", async () => {
    const ctx = await setup({ includePromotions: false });
    const calendar = await gen(ctx, "calendar");
    expect(calendar.content.entries.every((e) => !e.isPromotion)).toBe(true);
  });
});

describe("posts", () => {
  it("creates posts from the calendar once, writes them in a batch and normalizes per format", async () => {
    const ctx = await setup();
    await gen(ctx, "pillars");
    await gen(ctx, "calendar");
    expect(await createPostsFromCalendar(ctx.owner.user, ctx.ws, ctx.project.id)).toMatchObject({ created: 4 });
    expect(await createPostsFromCalendar(ctx.owner.user, ctx.ws, ctx.project.id)).toMatchObject({ created: 0, alreadyCreated: 4 });
    let posts = await listPosts(ctx.owner.user, ctx.ws, ctx.project.id);
    expect(posts.map((p) => p.scheduledDate)).toEqual(["2027-02-03", "2027-02-05", "2027-02-08", "2027-02-12"]);
    expect(posts.every((p) => p.status === "IDEA" && p.content === null)).toBe(true);

    const result = await generatePosts(ctx.owner.user, ctx.ws, ctx.project.id, { postIds: posts.map((p) => p.id) });
    expect(result).toMatchObject({ written: expect.any(Array), missing: [], isMock: true });
    expect(prompts.filter((p) => p.task === "posts")).toHaveLength(1);
    expect(prompts.at(-1).prompt).toContain('<post ref="4">');
    expect(prompts.at(-1).prompt).toContain("Date: 2027-02-03 (Wed)");

    posts = await listPosts(ctx.owner.user, ctx.ws, ctx.project.id);
    const [video, carousel, promo, story] = posts;
    expect(video.content.hashtags).toEqual(["#sourdough", "#LeedsBakery", "#realbread"]);
    expect(video.content.scenes.map((s) => s.seconds)).toEqual([3, 12]);
    expect(video.checks.durationSeconds).toBe(15);
    expect(video.content.slides).toEqual([]);
    expect(carousel.content.slides).toHaveLength(2);
    expect(carousel.content.audio).toBe("");
    expect(promo.content.promotion.code).toBe("LOAF10");
    expect(video.content.promotion).toEqual({ offer: "", code: "", validUntil: "", terms: "" });
    expect(story.content.frames).toHaveLength(1);
    expect(posts.every((p) => p.status === "DRAFT" && p.version === 1 && p.isMock)).toBe(true);
  });

  it("edits with revision history, validates dates/formats/status and reports platform checks", async () => {
    const ctx = await setup();
    const post = await createPost(ctx.owner.user, ctx.ws, ctx.project.id, { date: "2027-02-10", platform: "INSTAGRAM", format: "POST", title: "Quick caption", generate: true });
    expect(post).toMatchObject({ status: "DRAFT", version: 1 });
    expect(post.revisions.map((r) => r.source)).toEqual(["AI"]);

    const long = { ...post.content, caption: "x".repeat(2300), hashtags: Array.from({ length: 31 }, (_, i) => `tag${i}`) };
    const edited = await updatePost(ctx.owner.user, ctx.ws, ctx.project.id, post.id, { content: long, status: "READY" });
    expect(edited).toMatchObject({ status: "READY", version: 2 });
    expect(edited.revisions.map((r) => r.source)).toEqual(["EDIT", "AI"]);
    expect(edited.checks.warnings.join(" ")).toMatch(/allows 2200.*31 hashtags; Instagram allows 30/s);

    await expect(updatePost(ctx.owner.user, ctx.ws, ctx.project.id, post.id, { date: "2027-03-01" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updatePost(ctx.owner.user, ctx.ws, ctx.project.id, post.id, { date: "2027-02-30" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createPost(ctx.owner.user, ctx.ws, ctx.project.id, { date: "2027-02-10", platform: "LINKEDIN", format: "STORY", title: "x" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const idea = await createPost(ctx.owner.user, ctx.ws, ctx.project.id, { date: "2027-02-11", platform: "FACEBOOK", format: "POST", title: "Idea only" });
    await expect(updatePost(ctx.owner.user, ctx.ws, ctx.project.id, idea.id, { status: "READY" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await deletePost(ctx.owner.user, ctx.ws, ctx.project.id, idea.id);
    expect((await listPosts(ctx.owner.user, ctx.ws, ctx.project.id)).map((p) => p.id)).toEqual([post.id]);
  });

  it("re-planning replaces unwritten ideas but keeps written posts", async () => {
    const ctx = await setup();
    await gen(ctx, "calendar");
    await createPostsFromCalendar(ctx.owner.user, ctx.ws, ctx.project.id);
    const [first] = await listPosts(ctx.owner.user, ctx.ws, ctx.project.id);
    await generatePosts(ctx.owner.user, ctx.ws, ctx.project.id, { postIds: [first.id] });
    await gen(ctx, "calendar");
    expect(await createPostsFromCalendar(ctx.owner.user, ctx.ws, ctx.project.id)).toMatchObject({ created: 4, replaced: 3 });
    const posts = await listPosts(ctx.owner.user, ctx.ws, ctx.project.id);
    expect(posts).toHaveLength(5);
    expect(posts.filter((p) => p.content)).toHaveLength(1);
  });

  it("reports posts the AI skipped instead of inventing them", async () => {
    const ctx = await setup();
    const a = await createPost(ctx.owner.user, ctx.ws, ctx.project.id, { date: "2027-02-01", platform: "INSTAGRAM", format: "POST", title: "A" });
    const b = await createPost(ctx.owner.user, ctx.ws, ctx.project.id, { date: "2027-02-02", platform: "INSTAGRAM", format: "POST", title: "B" });
    setProviderOverrides({ text: createMockTextProvider({ responder: (req) => { const d = mockFixtureResponder(req).data; return { data: { posts: d.posts.slice(0, 1) } }; } }) });
    const r = await generatePosts(ctx.owner.user, ctx.ws, ctx.project.id, { postIds: [a.id, b.id] });
    expect(r.written).toEqual([a.id]);
    expect(r.missing).toEqual([b.id]);
    expect((await getPost(ctx.owner.user, ctx.ws, ctx.project.id, b.id)).status).toBe("IDEA");
  });

  it("exports CSV and Markdown safely", async () => {
    const ctx = await setup();
    const post = await createPost(ctx.owner.user, ctx.ws, ctx.project.id, { date: "2027-02-10", platform: "INSTAGRAM", format: "CAROUSEL", title: "=cmd|' /C calc'!A0", generate: true });
    const csv = await exportPosts(ctx.owner.user, ctx.ws, ctx.project.id, "csv");
    expect(csv.filename).toBe("crust-culture-2027-02-posts.csv");
    expect(csv.body).toContain(`'=cmd|' /C calc'!A0`);
    expect(csv.body).toContain("1. Slide 1: Start");
    const md = await exportPosts(ctx.owner.user, ctx.ws, ctx.project.id, "markdown");
    expect(md.body).toContain("## 2027-02-10 (Wed) · Instagram · Carousel");
    expect(md.body).toContain("sample data from the mock AI provider");
    expect(post.id).toBeTruthy();
  });
});

describe("permissions and isolation", () => {
  it("hides projects and posts from other workspaces and keeps viewers read-only", async () => {
    const ctx = await setup();
    const post = await createPost(ctx.owner.user, ctx.ws, ctx.project.id, { date: "2027-02-10", platform: "INSTAGRAM", format: "POST", title: "Private" });
    const other = await createUser();
    await expect(listPosts(other.user, other.workspace.id, ctx.project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getPost(other.user, other.workspace.id, ctx.project.id, post.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(generatePosts(other.user, other.workspace.id, ctx.project.id, { postIds: [post.id] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // A post id from another project in the caller's own workspace is also not found.
    const otherProject = await createSocialProject(ctx.owner.user, ctx.ws, { businessId: ctx.biz.id, month: "2027-03", platforms: ["INSTAGRAM"], postsPerWeek: 2 });
    await expect(getPost(ctx.owner.user, ctx.ws, otherProject.id, post.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(generatePosts(ctx.owner.user, ctx.ws, otherProject.id, { postIds: [post.id] })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    expect(await listPosts(viewer.user, ctx.ws, ctx.project.id)).toHaveLength(1);
    await expect(updatePost(viewer.user, ctx.ws, ctx.project.id, post.id, { title: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(generatePosts(viewer.user, ctx.ws, ctx.project.id, { postIds: [post.id] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await prisma.socialPostRevision.count()).toBe(0);
  });
});
