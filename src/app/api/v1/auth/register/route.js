import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { registerUser } from "@/server/auth/service.js";
import { registerSchema } from "@/validation/auth.js";

export const POST = route({ auth: false, rateLimit: "register" }, async ({ json, requestInfo }) => {
  const input = parseWith(registerSchema, await json());
  const { user } = await registerUser(input, requestInfo);
  return ok({ user }, { status: 201 });
});
