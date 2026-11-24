"use server";

import { cookies } from "next/headers";
import { requireUser } from "../auth/session.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { ACTIVE_WORKSPACE_COOKIE } from "../workspaces/active.js";

/** Switches the active workspace after verifying membership server-side. */
export async function switchWorkspaceAction(workspaceId) {
  const user = await requireUser();
  await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_READ);
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}
