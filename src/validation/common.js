import { z } from "zod";

export const uuidSchema = z.uuid({ message: "Invalid identifier." });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Enter your email address.")
  .max(320, "Email address is too long.")
  .pipe(z.email({ message: "Enter a valid email address." }));

// NIST 800-63B style: length over composition rules, with a sane upper bound
// (bcrypt only uses the first 72 bytes).
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use at most 72 characters.")
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9\W_]/.test(v), {
    message: "Include letters and at least one number or symbol.",
  });

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(120, "Name is too long.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Converts a ZodError into a { field: [messages] } map for API responses. */
export function flattenZodError(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
