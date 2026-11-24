import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { resetPassword } from "@/server/auth/service.js";
import { resetPasswordSchema } from "@/validation/auth.js";

export const POST = route({ auth: false, rateLimit: "passwordReset" }, async ({ json, requestInfo }) => {
  const input = parseWith(resetPasswordSchema, await json());
  await resetPassword(input, requestInfo);
  return ok({ message: "Your password has been reset. Please sign in." });
});
