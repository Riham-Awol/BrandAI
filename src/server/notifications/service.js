import "server-only";
import { prisma } from "../db/prisma.js";

/** In-app notifications. Email/push channels are added in Phase 8. */
export async function notify({ userId, workspaceId, type, title, body, link }) {
  return prisma.notification.create({ data: { userId, workspaceId: workspaceId ?? null, type, title, body, link } });
}

export async function listNotifications(user, { unreadOnly = false, take = 20 } = {}) {
  return prisma.notification.findMany({
    where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(take, 100),
  });
}

/** Marks notifications read; scoped to the user so ids cannot cross accounts. */
export async function markNotificationsRead(user, ids) {
  const { count } = await prisma.notification.updateMany({ where: { userId: user.id, id: { in: ids }, readAt: null }, data: { readAt: new Date() } });
  return count;
}
