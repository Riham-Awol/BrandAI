import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decode } from "next-auth/jwt";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { authOptions } from "./options.js";
import { toPublicUser } from "./service.js";

const SESSION_COOKIES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

/**
 * Data Access Layer entry point for the current user.
 * Decodes the Auth.js JWT cookie AND re-validates database state (user exists,
 * not deleted, session version unchanged) so password resets revoke sessions.
 * Memoized per request.
 */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const raw = SESSION_COOKIES.map((name) => store.get(name)?.value).find(Boolean);
  if (!raw) return null;

  let token;
  try {
    token = await decode({ token: raw, secret: authOptions.secret });
  } catch {
    return null;
  }
  if (!token?.uid) return null;

  const user = await prisma.user.findUnique({ where: { id: token.uid } });
  if (!user || user.deletedAt || user.suspendedAt || token.sv !== user.sessionVersion) return null;
  return toPublicUser(user);
});

/** For route handlers: throws UNAUTHENTICATED (401). */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthenticated();
  return user;
}

/** For pages/layouts: redirects to /login. */
export async function requireUserOrRedirect(callbackPath = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  return user;
}
