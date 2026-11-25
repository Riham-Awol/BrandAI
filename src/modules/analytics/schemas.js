import { z } from "zod";
import { uuidSchema } from "@/validation/common.js";
import { PERIODS } from "./metrics.js";

export const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().refine((d) => PERIODS.includes(d), "Choose 7, 30 or 90 days.").default(30),
  businessId: z.preprocess((v) => (v === "" || v === "all" ? undefined : v), uuidSchema.optional()),
});

export const exportQuerySchema = analyticsQuerySchema.extend({ format: z.enum(["csv", "md"]).default("csv") });

const count = z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().int().min(0).max(1_000_000_000).nullable().optional());

export const postMetricsSchema = z
  .object({ reach: count, impressions: count, likes: count, comments: count, shares: count, saves: count, clicks: count })
  .refine((m) => Object.values(m).some((v) => v != null), { message: "Enter at least one number.", path: ["reach"] });

export const analyticsSettingsSchema = z.object({
  trackSiteVisits: z.boolean(),
  trackEmailEngagement: z.boolean(),
  retentionDays: z.coerce.number().int().min(30).max(730),
});

export const insightsRequestSchema = analyticsQuerySchema;
