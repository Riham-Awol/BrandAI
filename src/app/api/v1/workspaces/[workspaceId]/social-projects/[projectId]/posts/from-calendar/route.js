import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { createPostsFromCalendar } from "@/modules/social/posts-service.js";

export const POST = route({}, async ({ user, params, requestInfo }) => ok(await createPostsFromCalendar(user, params.workspaceId, params.projectId, requestInfo), { status: 201 }));
