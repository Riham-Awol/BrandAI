import { z } from "zod";
import { FORMAT_KEYS, PLATFORM_KEYS } from "./platforms.js";

/** Social Media Studio schemas (client + server). */
const s = z.string();
const list = z.array(z.string());

export const socialInputSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month."),
  platforms: z.array(z.enum(PLATFORM_KEYS)).min(1, "Choose at least one platform.").max(4),
  postsPerWeek: z.coerce.number().int().min(1).max(14).default(4),
  focus: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  includePromotions: z.boolean().default(true),
});

export const createSocialProjectSchema = socialInputSchema.extend({ businessId: z.uuid() });

const platformKey = z.enum(PLATFORM_KEYS);
const formatKey = z.enum(FORMAT_KEYS);

export const SECTION_SCHEMAS = {
  pillars: z.object({
    pillars: z.array(z.object({ name: s, description: s, share: z.number().describe("Share of posts in percent."), examples: list })),
    platformPlans: z.array(z.object({ platform: platformKey, role: s, postsPerWeek: z.number(), formats: list, bestTimes: s, tone: s })),
    hashtagSets: z.array(z.object({ pillar: s, hashtags: list })),
    guidelines: list,
  }),
  calendar: z.object({
    entries: z.array(
      z.object({
        day: z.number().describe("Day of the month."),
        platform: platformKey,
        format: formatKey,
        pillar: s,
        title: s.describe("Short working title of the post."),
        objective: s,
        isPromotion: z.boolean(),
      }),
    ),
    notes: s,
  }),
};

export const SECTION_KEYS = Object.keys(SECTION_SCHEMAS);

/** One post's written content (all formats share one shape; unused parts stay empty). */
export const postContentSchema = z.object({
  hook: s.describe("Scroll-stopping first line."),
  caption: s.describe("Caption body without hashtags."),
  hashtags: list,
  callToAction: s,
  altText: s.describe("Image description for screen readers."),
  visualIdea: s.describe("What the image/video should show."),
  slides: z.array(z.object({ heading: s, text: s })).describe("Carousel slides; empty unless the format is CAROUSEL."),
  frames: z.array(z.object({ text: s, visual: s, interactive: s })).describe("Story frames; empty unless the format is STORY."),
  scenes: z.array(z.object({ seconds: z.number(), visual: s, voiceover: s, onScreenText: s })).describe("Video scenes; empty unless SHORT_VIDEO."),
  audio: s.describe("Music/sound suggestion for SHORT_VIDEO, otherwise empty."),
  promotion: z.object({ offer: s, code: s, validUntil: s, terms: s }).describe("Only for promotion posts; otherwise empty strings."),
});

export const generatedPostsSchema = z.object({
  posts: z.array(postContentSchema.extend({ ref: z.number().describe("The ref number of the requested post.") })),
});

export const createPostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  platform: platformKey,
  format: formatKey,
  title: z.string().trim().min(1, "Describe the post.").max(200),
  pillar: z.string().trim().max(120).optional(),
  objective: z.string().trim().max(500).optional(),
  isPromotion: z.boolean().default(false),
  generate: z.boolean().default(false),
});

export const updatePostSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["IDEA", "DRAFT", "READY"]).optional(),
  isPromotion: z.boolean().optional(),
  content: postContentSchema.optional(),
});

export const generatePostsSchema = z.object({
  postIds: z.array(z.uuid()).min(1).max(6),
  feedback: z.string().trim().max(1000).optional(),
});
