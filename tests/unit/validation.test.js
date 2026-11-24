import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, resetPasswordSchema } from "@/validation/auth.js";
import { approveContextSchema, createBusinessSchema, saveContextDraftSchema } from "@/validation/business.js";
import { flattenZodError } from "@/validation/common.js";

describe("auth validation", () => {
  it("normalizes email casing and whitespace", () => {
    const r = registerSchema.parse({ name: " Ada ", email: "  Ada@Example.COM ", password: "longpassword1" });
    expect(r).toEqual({ name: "Ada", email: "ada@example.com", password: "longpassword1" });
  });

  it("rejects weak and overlong passwords", () => {
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "onlyletterslong" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "a1".repeat(40) }).success).toBe(false);
  });

  it("requires a password to log in but does not apply strength rules", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("rejects malformed reset tokens", () => {
    expect(resetPasswordSchema.safeParse({ token: "short", password: "longpassword1" }).success).toBe(false);
  });

  it("flattens zod errors per field", () => {
    const result = registerSchema.safeParse({ name: "", email: "nope", password: "x" });
    const flat = flattenZodError(result.error);
    expect(Object.keys(flat).sort()).toEqual(["email", "name", "password"]);
  });
});

describe("business validation", () => {
  it("defaults stage to IDEA", () => {
    expect(createBusinessSchema.parse({ name: "Acme" }).stage).toBe("IDEA");
  });

  it("rejects unknown context sections (strict)", () => {
    expect(saveContextDraftSchema.safeParse({ data: { basics: { name: "x" } } }).success).toBe(true);
    expect(saveContextDraftSchema.safeParse({ data: { secrets: { x: 1 } } }).success).toBe(false);
  });

  it("requires at least one approved section", () => {
    expect(approveContextSchema.safeParse({ sections: [] }).success).toBe(false);
    expect(approveContextSchema.safeParse({ sections: ["basics"] }).success).toBe(true);
  });
});
