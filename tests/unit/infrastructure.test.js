import { afterEach, describe, expect, it } from "vitest";
import { createMemoryStore } from "@/server/rate-limit/memory-store.js";
import { createRateLimiter } from "@/server/rate-limit/limiter.js";
import { slugify, uniqueSlug } from "@/server/workspaces/slug.js";
import { parseDatabaseUrl } from "@/server/db/create-client.js";
import { _sanitizeForTests as sanitize } from "@/server/logger.js";
import { getEnv, resetEnvCache } from "@/server/config/env.js";
import { generateToken, hashToken } from "@/server/auth/tokens.js";
import { AppError } from "@/server/errors.js";

describe("rate limiter", () => {
  it("allows up to the limit then blocks with retry-after", async () => {
    const limiter = createRateLimiter(createMemoryStore());
    const policy = { limit: 2, windowMs: 60_000 };
    expect((await limiter.check("k", policy)).allowed).toBe(true);
    expect((await limiter.check("k", policy)).allowed).toBe(true);
    const third = await limiter.check("k", policy);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    await expect(limiter.enforce("k", policy)).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("isolates keys", async () => {
    const limiter = createRateLimiter(createMemoryStore());
    const policy = { limit: 1, windowMs: 60_000 };
    await limiter.check("a", policy);
    expect((await limiter.check("b", policy)).allowed).toBe(true);
  });
});

describe("slugs", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("Café Déjà Vu!!")).toBe("cafe-deja-vu");
    expect(slugify("***")).toBe("workspace");
    expect(uniqueSlug("Acme")).toMatch(/^acme-[a-f0-9]{6}$/);
  });
});

describe("database url parsing", () => {
  it("parses credentials and options", () => {
    const c = parseDatabaseUrl("mysql://u%40x:p%23w@db.example.com:3307/app?connection_limit=3&sslaccept=strict");
    expect(c).toMatchObject({ host: "db.example.com", port: 3307, user: "u@x", password: "p#w", database: "app", connectionLimit: 3 });
    expect(c.ssl).toEqual({ rejectUnauthorized: true });
  });
  it("rejects other protocols", () => {
    expect(() => parseDatabaseUrl("postgres://x@y/z")).toThrow();
    expect(() => parseDatabaseUrl("")).toThrow();
  });
});

describe("logger", () => {
  it("redacts secret-looking keys", () => {
    expect(sanitize({ password: "x", nested: { apiKey: "y", ok: 1 } })).toEqual({ password: "[redacted]", nested: { apiKey: "[redacted]", ok: 1 } });
  });
});

describe("tokens", () => {
  it("stores only a hash of the token", () => {
    const { token, tokenHash } = generateToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
  });
});

describe("env validation", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetEnvCache();
  });

  it("refuses mock AI in production", () => {
    Object.assign(process.env, { DATABASE_URL: "mysql://a:b@c/d", APP_ENV: "production", NEXTAUTH_SECRET: "x", AI_TEXT_PROVIDER: "mock", EMAIL_PROVIDER: "resend" });
    resetEnvCache();
    expect(() => getEnv()).toThrow(/Mock AI/);
  });

  it("refuses the console email provider in production", () => {
    Object.assign(process.env, { DATABASE_URL: "mysql://a:b@c/d", APP_ENV: "production", NEXTAUTH_SECRET: "x", AI_TEXT_PROVIDER: "anthropic", AI_ALLOW_MOCK: "false", EMAIL_PROVIDER: "console" });
    resetEnvCache();
    expect(() => getEnv()).toThrow(/console/);
  });
});

describe("AppError", () => {
  it("carries code and status", () => {
    const e = new AppError("X", "msg", 418);
    expect([e.code, e.status, e.message]).toEqual(["X", 418, "msg"]);
  });
});
