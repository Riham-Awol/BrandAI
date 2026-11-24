import { z } from "zod";
import { INTEGRATION_TYPES, MODE_KEYS, RULE_TEMPLATE_KEYS } from "./catalog.js";

const text = (max) => z.string().trim().max(max).optional().transform((v) => (v === "" ? undefined : v));
const httpsUrl = z.string().trim().max(500).refine((u) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use a full https:// URL.");

export const settingsSchema = z.object({
  mode: z.enum(MODE_KEYS),
  dailyPublishLimit: z.coerce.number().int().min(0).max(100),
  dailyEmailLimit: z.coerce.number().int().min(0).max(5000),
  requireSeparateApprover: z.boolean(),
  timezone: z.string().trim().max(60).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone."),
});

export const integrationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("WEBHOOK"), name: z.string().trim().min(1).max(120), url: httpsUrl }),
  z.object({ type: z.literal("TELEGRAM"), name: z.string().trim().min(1).max(120), botToken: z.string().trim().regex(/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/, "That doesn't look like a bot token."), chatId: z.string().trim().regex(/^(@[A-Za-z0-9_]{5,32}|-?\d{5,20})$/, "Use @channelname or a numeric chat ID.") }),
  z.object({ type: z.literal("FACEBOOK_PAGE"), name: z.string().trim().min(1).max(120), pageId: z.string().trim().regex(/^\d{5,25}$/, "Page IDs are numbers."), accessToken: z.string().trim().min(20).max(1000) }),
]);
export { INTEGRATION_TYPES };

export const scheduleSchema = z.object({
  businessId: z.uuid(),
  sourceType: z.enum(["SOCIAL_POST", "EMAIL_CAMPAIGN", "CUSTOM"]),
  sourceId: z.uuid().optional(),
  title: text(200),
  text: z.string().trim().max(5000).optional(),
  link: httpsUrl.optional().or(z.literal("").transform(() => undefined)),
  integrationId: z.uuid().nullable().optional(),
  scheduledAt: z.iso.datetime({ offset: true }),
  submit: z.boolean().default(true),
});

export const rescheduleSchema = z.object({ scheduledAt: z.iso.datetime({ offset: true }) });
export const decisionSchema = z.object({ note: text(500) });
export const markPostedSchema = z.object({ externalUrl: httpsUrl.optional().or(z.literal("").transform(() => undefined)) });

export const reminderSchema = z.object({ title: z.string().trim().min(1).max(200), note: text(1000), dueAt: z.iso.datetime({ offset: true }), link: z.string().trim().regex(/^\/[\w\-/?=&.%#]*$/, "Use an in-app path.").max(300).optional().or(z.literal("").transform(() => undefined)) });

export const ruleSchema = z.object({
  template: z.enum(RULE_TEMPLATE_KEYS),
  name: z.string().trim().min(1).max(160),
  integrationId: z.uuid().nullable().optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.").optional(),
  enabled: z.boolean().default(true),
});
export const ruleUpdateSchema = z.object({ enabled: z.boolean().optional(), name: z.string().trim().min(1).max(160).optional() });

export const contactSchema = z.object({
  businessId: z.uuid(),
  email: z.email("Enter a valid email.").max(254).transform((e) => e.toLowerCase()),
  name: text(120),
  consentSource: z.string().trim().min(3, "Say how this person agreed to receive emails.").max(200),
  consentConfirmed: z.literal(true, { error: "Confirm you have this person's consent." }),
});

export const importSchema = z.object({
  businessId: z.uuid(),
  csv: z.string().max(1_000_000),
  consentSource: z.string().trim().min(3, "Say how these people agreed to receive emails.").max(200),
  consentConfirmed: z.literal(true, { error: "Confirm you have consent for everyone in the file." }),
});

export const campaignContentSchema = z.object({
  heading: z.string().trim().max(160),
  paragraphs: z.array(z.string().trim().max(1500)).max(8),
  ctaLabel: z.string().trim().max(40),
  ctaUrl: httpsUrl.or(z.literal("")),
});

export const campaignSchema = z.object({
  businessId: z.uuid(),
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1, "Write a subject line.").max(200),
  preheader: z.string().trim().max(200).default(""),
  content: campaignContentSchema,
});
export const campaignUpdateSchema = campaignSchema.omit({ businessId: true });

export const campaignDraftSchema = z.object({ businessId: z.uuid(), brief: z.string().trim().min(5, "Describe the email.").max(1500) });

export const aiCampaignSchema = z.object({
  subject: z.string().describe("Subject line, max 60 characters, no spammy capitals."),
  preheader: z.string().describe("Preview text, max 90 characters."),
  heading: z.string(),
  paragraphs: z.array(z.string()).describe("2–4 short paragraphs."),
  ctaLabel: z.string().describe("Button text, max 4 words."),
});
