import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { requestPasswordReset } from "@/server/auth/service.js";
import { forgotPasswordSchema } from "@/validation/auth.js";

// Always returns the same response so account existence is not revealed.
export const POST = route({ auth: false, rateLimit: "passwordForgot" }, async ({ json, requestInfo }) => {
  const input = parseWith(forgotPasswordSchema, await json());
  await requestPasswordReset(input, requestInfo);
  return ok({ message: "If an account exists for that email, a reset link has been sent." }, { status: 202 });
});
