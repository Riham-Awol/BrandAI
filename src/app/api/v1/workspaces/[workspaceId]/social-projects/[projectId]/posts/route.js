import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { createPost, listPosts } from "@/modules/social/posts-service.js";
import { createPostSchema } from "@/modules/social/schemas.js";

export const maxDuration = 300;

export const GET = route({}, async ({ user, params }) => ok(await listPosts(user, params.workspaceId, params.projectId)));

/** Quick tool: add a single post; `generate: true` also writes it with AI. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(createPostSchema, await json());
  return ok(await createPost(user, params.workspaceId, params.projectId, input, requestInfo), { status: 201 });
});
