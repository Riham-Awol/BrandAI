import { z } from "zod";
import { displayNameSchema, emailSchema, passwordSchema } from "./common.js";

export const registerSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(200),
  // Two-factor code or recovery code (only sent when the account asks for it).
  otp: z.string().trim().max(20).optional().transform((v) => v || undefined),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});
