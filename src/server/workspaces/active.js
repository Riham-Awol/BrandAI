import "server-only";
import { cookies } from "next/headers";
import { resolveActiveWorkspace } from "./service.js";

export const ACTIVE_WORKSPACE_COOKIE = "brandai_ws";

/** The workspace the user is working in (validated against membership). */
export async function getActiveWorkspace(userId) {
  const requested = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  return resolveActiveWorkspace(userId, requested);
}
