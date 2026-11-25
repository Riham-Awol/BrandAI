import { z } from "zod";
import { displayNameSchema, passwordSchema } from "./common.js";

const code = z.string().trim().min(6, "Enter the code.").max(20);

export const profileSchema = z.object({ name: displayNameSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, "Enter your current password.").max(200), newPassword: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(32).max(128) });
export const mfaCodeSchema = z.object({ code });
export const disableMfaSchema = z.object({ password: z.string().min(1, "Enter your password.").max(200), code });
export const deleteAccountSchema = z.object({ password: z.string().min(1, "Enter your password.").max(200), confirm: z.literal("DELETE", { message: "Type DELETE to confirm." }) });
