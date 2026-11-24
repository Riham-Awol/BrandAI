import { ok } from "@/server/http/api-response.js";
import { route } from "@/server/http/route-handler.js";
import { duplicateDesign } from "@/modules/design/service.js";

export const POST = route({}, async ({ user, params, requestInfo }) => ok(await duplicateDesign(user, params.workspaceId, params.designId, requestInfo), { status: 201 }));
