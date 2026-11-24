import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { generatePosts } from "@/modules/social/posts-service.js";
import { generatePostsSchema } from "@/modules/social/schemas.js";

export const maxDuration = 300;

/** Writes up to 6 posts in one AI call. */
export const POST = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(generatePostsSchema, await json());
  return ok(await generatePosts(user, params.workspaceId, params.projectId, input, requestInfo));
});
