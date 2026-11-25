import "server-only";
import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "../auth/session.js";
import { requirePlatformAdmin } from "./admin-service.js";

/** For admin pages: 404 for non-admins; `{ needsMfa: true }` when two-factor is off. */
export async function guardAdminPage(path) {
  const user = await requireUserOrRedirect(path);
  try {
    await requirePlatformAdmin(user);
    return { user, needsMfa: false };
  } catch (error) {
    if (error?.code === "MFA_REQUIRED") return { user, needsMfa: true };
    notFound();
  }
}
