/**
 * Typed application errors. Route handlers convert these into the standard
 * API error envelope; anything else becomes a generic 500 without internals.
 */
export class AppError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Errors = {
  validation: (details, message = "The submitted data is invalid.") =>
    new AppError("VALIDATION_ERROR", message, 422, details),
  unauthenticated: (message = "You must be signed in.") => new AppError("UNAUTHENTICATED", message, 401),
  forbidden: (message = "You do not have permission to perform this action.") =>
    new AppError("FORBIDDEN", message, 403),
  // Used when a resource exists but belongs to another tenant: never reveal existence.
  notFound: (message = "The requested resource was not found.") => new AppError("NOT_FOUND", message, 404),
  conflict: (message) => new AppError("CONFLICT", message, 409),
  rateLimited: (retryAfterSeconds) =>
    new AppError("RATE_LIMITED", "Too many requests. Please try again later.", 429, { retryAfterSeconds }),
  usageLimit: (message = "Your workspace has reached its usage limit.") =>
    new AppError("USAGE_LIMIT_REACHED", message, 402),
  notConfigured: (service) =>
    new AppError("SERVICE_NOT_CONFIGURED", `${service} is not configured on this server.`, 503),
  upstream: (message = "An external service failed. Please try again.") => new AppError("UPSTREAM_ERROR", message, 502),
};

export function isAppError(error) {
  return error instanceof AppError;
}
