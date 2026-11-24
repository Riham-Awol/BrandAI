import { NextResponse } from "next/server";
import { isAppError } from "../errors.js";
import { logger } from "../logger.js";

/**
 * Standard API envelope:
 *   success: { ok: true, data, meta? }
 *   failure: { ok: false, error: { code, message, details? } }
 */
export function ok(data, { status = 200, meta, headers } = {}) {
  return NextResponse.json(meta ? { ok: true, data, meta } : { ok: true, data }, { status, headers });
}

export function fail(code, message, status = 400, details) {
  const error = details === undefined ? { code, message } : { code, message, details };
  return NextResponse.json({ ok: false, error }, { status });
}

export function errorResponse(error, context = {}) {
  if (isAppError(error)) {
    const res = fail(error.code, error.message, error.status, error.details);
    if (error.code === "RATE_LIMITED" && error.details?.retryAfterSeconds) {
      res.headers.set("Retry-After", String(error.details.retryAfterSeconds));
    }
    return res;
  }
  logger.error("Unhandled API error", { ...context, error });
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}
