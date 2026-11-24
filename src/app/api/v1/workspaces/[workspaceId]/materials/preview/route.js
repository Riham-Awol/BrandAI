import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { previewMaterial } from "@/modules/stationery/materials-service.js";
import { materialPreviewSchema } from "@/modules/stationery/schemas.js";

/** Live preview of an unsaved spec (all views). */
export const POST = route({}, async ({ user, params, json }) => ok(await previewMaterial(user, params.workspaceId, parseWith(materialPreviewSchema, await json()))));
