import { describe, expect, it } from "vitest";
import { checkPost, composeCaption, daysInMonth, normalizeHashtags, normalizePostContent, weekday, PLATFORMS } from "@/modules/social/platforms.js";
import { SECTION_KEYS, SECTION_SCHEMAS, createPostSchema, createSocialProjectSchema, generatedPostsSchema, generatePostsSchema } from "@/modules/social/schemas.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/social/mock-fixtures.js";
import { postProcessSocial } from "@/modules/social/service.js";

const empty = { hook: "", caption: "", hashtags: [], callToAction: "", altText: "", visualIdea: "", slides: [], frames: [], scenes: [], audio: "", promotion: { offer: "", code: "", validUntil: "", terms: "" } };
const project = { input: { month: "2027-02", platforms: ["INSTAGRAM", "FACEBOOK"], postsPerWeek: 3, includePromotions: true } };

describe("platform helpers", () => {
  it("normalizes hashtags", () => {
    expect(normalizeHashtags(["#Sour dough!", "sourdough", "##Leeds", "", "café_life"])).toEqual(["#Sourdough", "#Leeds", "#café_life"]);
  });
  it("composes the posted text and computes checks", () => {
    const c = { ...empty, caption: "Hi", callToAction: "Visit", hashtags: ["#a", "#b"] };
    expect(composeCaption(c)).toBe("Hi\n\nVisit\n\n#a #b");
    expect(checkPost("INSTAGRAM", "POST", c)).toMatchObject({ captionLength: 16, hashtagCount: 2, warnings: [] });
    expect(checkPost("LINKEDIN", "STORY", c).warnings[0]).toMatch(/not supported on LinkedIn/);
    expect(checkPost("INSTAGRAM", "CAROUSEL", { ...c, slides: [{ heading: "1", text: "" }] }).warnings).toContain("A carousel needs at least 2 slides.");
    const video = checkPost("FACEBOOK", "SHORT_VIDEO", { ...c, scenes: [{ seconds: 60 }, { seconds: 45 }] });
    expect(video.durationSeconds).toBe(105);
    expect(video.warnings.join()).toMatch(/runs 105s; Facebook allows 90s/);
    expect(checkPost("INSTAGRAM", "POST", { ...c, hashtags: Array.from({ length: 8 }, (_, i) => `#t${i}`) }).warnings[0]).toMatch(/5 or fewer/);
  });
  it("keeps only the parts that belong to the format", () => {
    const raw = { ...empty, slides: [{ heading: "a", text: "b" }], frames: [{ text: "f", visual: "", interactive: "" }], scenes: [{ seconds: 2.6, visual: "", voiceover: "", onScreenText: "" }], audio: "beat", promotion: { offer: "x", code: "Y", validUntil: "", terms: "" } };
    const story = normalizePostContent(raw, { format: "STORY", isPromotion: false });
    expect(story).toMatchObject({ slides: [], frames: raw.frames, scenes: [], audio: "", promotion: { code: "" } });
    const video = normalizePostContent(raw, { format: "SHORT_VIDEO", isPromotion: true });
    expect(video.scenes[0].seconds).toBe(3);
    expect(video.promotion.code).toBe("Y");
  });
  it("handles calendar dates", () => {
    expect(daysInMonth("2027-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(weekday("2027-02-03")).toBe("Wed");
    expect(Object.keys(PLATFORMS)).toEqual(["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN"]);
  });
});

describe("social sections", () => {
  it("keeps fixtures valid", () => {
    for (const k of SECTION_KEYS) expect(SECTION_SCHEMAS[k].safeParse(mockFixtureResponder({ module: "social", task: k }).data).success, k).toBe(true);
    const posts = mockFixtureResponder({ module: "social", task: "posts", prompt: '<post ref="1">\nFormat: Post\n</post><post ref="2">\nFormat: Carousel\n</post>' }).data;
    expect(generatedPostsSchema.safeParse(posts).success).toBe(true);
    expect(posts.posts.map((p) => p.ref)).toEqual([1, 2]);
  });
  it("filters calendar entries to the month, platforms and allowed formats", () => {
    const data = mockFixtureResponder({ module: "social", task: "calendar" }).data;
    data.entries.push({ day: 2, platform: "FACEBOOK", format: "SHORT_VIDEO", pillar: "", title: "ok", objective: "", isPromotion: false });
    const out = postProcessSocial("calendar", data, { project });
    expect(out.entries.map((e) => e.day)).toEqual([2, 3, 5, 8, 12]);
    const noPromo = postProcessSocial("calendar", data, { project: { input: { ...project.input, includePromotions: false } } });
    expect(noPromo.entries.some((e) => e.isPromotion)).toBe(false);
    expect(() => postProcessSocial("calendar", { entries: [{ ...data.entries[0], day: 31 }], notes: "" }, { project })).toThrow();
  });
  it("normalizes pillar shares to 100", () => {
    const out = postProcessSocial("pillars", { pillars: [{ name: "a", description: "", share: 1, examples: [] }, { name: "b", description: "", share: 3, examples: [] }], platformPlans: [], hashtagSets: [], guidelines: [] });
    expect(out.pillars.map((p) => p.share)).toEqual([25, 75]);
  });
});

describe("input validation", () => {
  it("validates plans, posts and batches", () => {
    const id = crypto.randomUUID();
    expect(createSocialProjectSchema.parse({ businessId: id, month: "2027-02", platforms: ["TIKTOK"] })).toMatchObject({ postsPerWeek: 4, includePromotions: true });
    expect(createSocialProjectSchema.safeParse({ businessId: id, month: "2027-13", platforms: ["TIKTOK"] }).success).toBe(false);
    expect(createSocialProjectSchema.safeParse({ businessId: id, month: "2027-02", platforms: [] }).success).toBe(false);
    expect(createSocialProjectSchema.safeParse({ businessId: id, month: "2027-02", platforms: ["MYSPACE"] }).success).toBe(false);
    expect(createPostSchema.safeParse({ date: "2027-02-01", platform: "INSTAGRAM", format: "POST", title: "" }).success).toBe(false);
    expect(generatePostsSchema.safeParse({ postIds: Array.from({ length: 7 }, () => crypto.randomUUID()) }).success).toBe(false);
  });
});
