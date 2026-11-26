import { z } from "zod";
import { emailSchema, uuidSchema } from "./common.js";

const workspaceName = z.string().trim().min(2, "Use at least 2 characters.").max(120);
export const renameWorkspaceSchema = z.object({ name: workspaceName });
export const createWorkspaceSchema = z.object({ name: workspaceName, type: z.enum(["TEAM", "AGENCY"]).default("TEAM") });
export const deleteWorkspaceSchema = z.object({ confirmName: z.string().max(120) });
export const inviteSchema = z.object({ email: emailSchema, role: z.enum(["ADMIN", "EDITOR", "VIEWER"]) });
export const roleSchema = z.object({ role: z.enum(["ADMIN", "EDITOR", "VIEWER"]) });
export const transferSchema = z.object({ memberId: uuidSchema, password: z.string().min(1, "Enter your password.").max(200) });
export const inviteTokenSchema = z.object({ token: z.string().min(32).max(128) });
export const auditQuerySchema = z.object({
  action: z.string().trim().max(60).regex(/^[a-z_.]*$/, "Invalid filter.").optional().transform((v) => v || undefined),
  before: z.iso.datetime().optional(),
});

export const checkoutSchema = z.object({ plan: z.enum(["PRO", "AGENCY"]) });
export const creditsSchema = z.object({ pack: z.enum(["credits_500"]) });

const optionalText = (max) => z.string().trim().max(max).optional().transform((v) => v || undefined);
export const clientSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(120),
  contactName: optionalText(120),
  contactEmail: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().pipe(z.email({ message: "Enter a valid email address." })).optional()),
  notes: optionalText(2000),
});
export const clientUpdateSchema = clientSchema.partial().extend({ status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional() });

export const aiMemoryQuerySchema = z.object({ businessId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()) });
export const aiLearningSchema = z.object({ enabled: z.boolean() });
