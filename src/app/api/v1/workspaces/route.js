import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createWorkspaceForUser, listWorkspacesForUser } from "@/server/workspaces/service.js";
import { createWorkspaceSchema } from "@/validation/workspace.js";

export const GET = route({}, async ({ user }) => ok(await listWorkspacesForUser(user.id)));

export const POST = route({}, async ({ user, json }) => {
  const input = parseWith(createWorkspaceSchema, await json());
  const workspace = await createWorkspaceForUser({ userId: user.id, ...input });
  return ok(workspace, { status: 201 });
});
