import { z } from "zod";
import { ok } from "@/server/http/api-response.js";
import { parseWith, route } from "@/server/http/route-handler.js";
import { listNotifications, markNotificationsRead } from "@/server/notifications/service.js";

export const GET = route({}, async ({ user, request }) => {
  const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";
  return ok(await listNotifications(user, { unreadOnly }));
});

const markReadSchema = z.object({ ids: z.array(z.uuid()).min(1).max(100) });

export const PATCH = route({}, async ({ user, json }) => {
  const { ids } = parseWith(markReadSchema, await json());
  return ok({ updated: await markNotificationsRead(user, ids) });
});
