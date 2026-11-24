import "server-only";
import { flattenZodError } from "@/validation/common.js";
import { Errors } from "../errors.js";
import { requireUser } from "../auth/session.js";
import { enforceRateLimit } from "../rate-limit/index.js";
import { errorResponse } from "./api-response.js";
import { getRequestInfo } from "./request-info.js";

const MAX_JSON_BYTES = 1_000_000;

/**
 * Wraps a route handler with the cross-cutting concerns every endpoint needs:
 * authentication, rate limiting, JSON parsing limits and error mapping.
 *
 *   export const POST = route({ auth: true, rateLimit: "api" }, async ({ user, request, params, json }) => ...)
 */
export function route(options, handler) {
  const { auth = true, rateLimit = "api" } = options;
  return async function wrapped(request, context) {
    const requestInfo = getRequestInfo(request);
    try {
      assertSameOrigin(request);
      const user = auth ? await requireUser() : null;
      if (rateLimit) await enforceRateLimit(rateLimit, user ? `user:${user.id}` : `ip:${requestInfo.ip}`);
      const params = context?.params ? await context.params : {};
      return await handler({ request, params, user, requestInfo, json: () => readJson(request) });
    } catch (error) {
      return errorResponse(error, { path: new URL(request.url).pathname, method: request.method });
    }
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence in depth (cookies are also SameSite=Lax and mutations require a
 * JSON content type): reject cross-origin state-changing requests.
 */
function assertSameOrigin(request) {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw Errors.forbidden("Cross-origin request rejected.");
  }
  if (originHost !== host) throw Errors.forbidden("Cross-origin request rejected.");
}

async function readJson(request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw Errors.validation({ _: ["Expected application/json."] });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_JSON_BYTES) throw Errors.validation({ _: ["Request body is too large."] });
  try {
    return await request.json();
  } catch {
    throw Errors.validation({ _: ["Malformed JSON body."] });
  }
}

/** Validates input with a Zod schema, throwing a VALIDATION_ERROR with field details. */
export function parseWith(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw Errors.validation(flattenZodError(result.error));
  return result.data;
}
