import { z } from "zod";

const reason = z.string().trim().max(300).optional().transform((v) => v || undefined);
export const searchSchema = z.object({ q: z.string().trim().max(120).optional().transform((v) => v || undefined) });
export const suspendSchema = z.object({ suspended: z.boolean(), reason });
export const setPlanSchema = z.object({ plan: z.enum(["FREE", "PRO", "AGENCY"]), note: reason });
export const grantCreditsSchema = z.object({ amount: z.coerce.number().int().min(-100000).max(100000).refine((n) => n !== 0, "Enter a non-zero amount."), note: z.string().trim().min(3, "Say why (shown in the ledger).").max(300) });
export const aiPauseSchema = z.object({ paused: z.boolean(), message: z.string().trim().max(300).optional() });
export const signupsSchema = z.object({ open: z.boolean() });
export const platformAuditSchema = z.object({
  action: z.string().trim().max(60).regex(/^[a-z_.]*$/).optional().transform((v) => v || undefined),
  actor: z.string().trim().max(120).optional().transform((v) => v || undefined),
  workspaceId: z.uuid().optional(),
  before: z.iso.datetime().optional(),
});
