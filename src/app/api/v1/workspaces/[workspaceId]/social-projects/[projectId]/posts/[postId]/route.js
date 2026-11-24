import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { deletePost, getPost, updatePost } from "@/modules/social/posts-service.js";
import { updatePostSchema } from "@/modules/social/schemas.js";

export const GET = route({}, async ({ user, params }) => ok(await getPost(user, params.workspaceId, params.projectId, params.postId)));

export const PATCH = route({}, async ({ user, params, json, requestInfo }) => {
  const input = parseWith(updatePostSchema, await json());
  return ok(await updatePost(user, params.workspaceId, params.projectId, params.postId, input, requestInfo));
});

export const DELETE = route({}, async ({ user, params, requestInfo }) => {
  await deletePost(user, params.workspaceId, params.projectId, params.postId, requestInfo);
  return ok({ deleted: true });
});
