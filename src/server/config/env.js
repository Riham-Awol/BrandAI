import { z } from "zod";

/**
 * Server environment, validated once on first access.
 * Never import this module from client components: it may contain secrets.
 */
const emptyToUndefined = (v) => (v === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  APP_URL: z.preprocess(emptyToUndefined, z.url().default("http://localhost:3000")),
  // Phase 6: where custom domains should point (CNAME). Defaults to the APP_URL host.
  SITES_CNAME_TARGET: optionalString,
  // Phase 8: 32-byte base64 key that encrypts integration credentials; bearer token for /api/v1/cron/run.
  INTEGRATIONS_ENCRYPTION_KEY: optionalString,
  CRON_SECRET: optionalString,

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  NEXTAUTH_SECRET: optionalString,
  NEXTAUTH_URL: optionalString,

  // AI
  // Free options: gemini (default), groq, openrouter, ollama, openai_compatible. Paid: anthropic.
  AI_TEXT_PROVIDER: z.enum(["gemini", "groq", "openrouter", "ollama", "openai_compatible", "anthropic", "mock"]).default("gemini"),
  AI_IMAGE_PROVIDER: z.enum(["none", "mock"]).default("none"),
  AI_TEXT_MODEL: optionalString,
  AI_TEXT_FALLBACK_MODELS: optionalString,
  // Free providers tried when the primary is busy/out of quota, e.g. "openrouter,groq".
  AI_TEXT_FALLBACK_PROVIDERS: optionalString,
  AI_BASE_URL: optionalString,
  AI_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GROQ_API_KEY: optionalString,
  OPENROUTER_API_KEY: optionalString,
  AI_ALLOW_MOCK: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("false")),
  ANTHROPIC_API_KEY: optionalString,

  // Storage
  STORAGE_PROVIDER: z.enum(["database", "s3", "memory", "none"]).default("database"),
  S3_ENDPOINT: optionalString,
  S3_REGION: z.preprocess(emptyToUndefined, z.string().default("auto")),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("false")),
  S3_PUBLIC_BASE_URL: optionalString,

  // Email
  EMAIL_PROVIDER: z.enum(["console", "resend", "none"]).default("console"),
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().default("Brand AI <no-reply@example.com>")),
  RESEND_API_KEY: optionalString,
  // Phase 10: Resend webhook signing secret (bounces/complaints).
  RESEND_WEBHOOK_SECRET: optionalString,
  // Phase 10: Stripe (payments). Missing values → checkout reports SERVICE_NOT_CONFIGURED.
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_PRO: optionalString,
  STRIPE_PRICE_AGENCY: optionalString,
  STRIPE_PRICE_CREDITS_500: optionalString,
  // Phase 10: platform admins must have two-factor sign-in on (set "false" only for local development).
  PLATFORM_ADMIN_REQUIRE_MFA: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("true")),

  // Rate limiting
  RATE_LIMIT_STORE: z.enum(["database", "memory"]).default("database"),
  // Load testing only; always 1 when APP_ENV=production.
  RATE_LIMIT_MULTIPLIER: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(10000).default(1)),
});

let cached;

export function getEnv() {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && !env.NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET must be set in production.");
  }
  if (env.APP_ENV === "production" && (env.AI_TEXT_PROVIDER === "mock" || env.AI_ALLOW_MOCK === "true")) {
    throw new Error("Mock AI providers are not allowed in production.");
  }
  if (env.APP_ENV === "production" && env.EMAIL_PROVIDER === "console") {
    throw new Error("EMAIL_PROVIDER=console is not allowed in production.");
  }
  cached = env;
  return env;
}

/** Test helper: clears the memoized environment. */
export function resetEnvCache() {
  cached = undefined;
}
