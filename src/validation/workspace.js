import { z } from "zod";

export const WORKSPACE_TYPES = ["PERSONAL", "TEAM", "AGENCY"];

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(120),
  type: z.enum(WORKSPACE_TYPES).default("TEAM"),
});
