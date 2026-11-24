/**
 * Browser helper for the Brand AI JSON API. Returns the `data` payload or
 * throws an ApiError carrying the standard { code, message, details }.
 */
export class ApiError extends Error {
  constructor({ code, message, details }, status) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export async function apiRequest(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      signal,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError({ code: "NETWORK_ERROR", message: "Could not reach the server. Check your connection." }, 0);
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    throw new ApiError(payload?.error ?? { code: "UNKNOWN", message: "Unexpected server response." }, res.status);
  }
  return payload.data;
}
