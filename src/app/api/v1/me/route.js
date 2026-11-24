import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { listWorkspacesForUser } from "@/server/workspaces/service.js";

export const GET = route({}, async ({ user }) => {
  const workspaces = await listWorkspacesForUser(user.id);
  return ok({ user, workspaces });
});
