import "server-only";
import CredentialsProvider from "next-auth/providers/credentials";
import { loginSchema } from "@/validation/auth.js";
import { enforceRateLimit } from "../rate-limit/index.js";
import { hashToken } from "./tokens.js";
import { verifyCredentials } from "./service.js";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function requestInfoFromAuthorizeRequest(req) {
  const h = req?.headers ?? {};
  const get = (k) => (typeof h.get === "function" ? h.get(k) : h[k]);
  const forwarded = get("x-forwarded-for");
  return { ip: (forwarded ? String(forwarded).split(",")[0] : get("x-real-ip")) || "unknown", userAgent: get("user-agent") ?? null };
}

/**
 * Auth.js (NextAuth v4) configuration.
 * - Credentials (email + password) sign-in, JWT session cookie (httpOnly, secure in prod).
 * - The JWT carries only the user id and session version; every server-side
 *   read re-validates against the database (see session.js).
 */
export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials ?? {});
        if (!parsed.success) return null;
        const request = requestInfoFromAuthorizeRequest(req);
        // Limit per IP and per account to slow brute-force and credential stuffing.
        await enforceRateLimit("login", `ip:${request.ip}`);
        await enforceRateLimit("login", `email:${hashToken(parsed.data.email)}`);
        const user = await verifyCredentials(parsed.data, request);
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.sv = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = { id: token.uid, email: token.email, name: token.name };
      return session;
    },
  },
  events: {},
};

export { SESSION_MAX_AGE };
