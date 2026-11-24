import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { uuidSchema } from "@/validation/common.js";

const select = { id: true, title: true, note: true, link: true, dueAt: true, firedAt: true, doneAt: true, createdAt: true };

/** Personal reminders (the runner turns due ones into notifications). */
export async function listReminders(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.reminder.findMany({ where: { workspaceId: scope.workspaceId, userId: user.id }, orderBy: [{ doneAt: "asc" }, { dueAt: "asc" }], take: 200, select });
}

export async function createReminder(user, workspaceId, input) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.reminder.create({ data: { workspaceId: scope.workspaceId, userId: user.id, createdById: user.id, title: input.title, note: input.note ?? null, link: input.link ?? null, dueAt: new Date(input.dueAt) }, select });
}

export async function updateReminder(user, workspaceId, id, { done }) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const { count } = await prisma.reminder.updateMany({ where: { id, workspaceId: scope.workspaceId, userId: user.id }, data: { doneAt: done ? new Date() : null } });
  if (!count) throw Errors.notFound();
}

export async function deleteReminder(user, workspaceId, id) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const { count } = await prisma.reminder.deleteMany({ where: { id, workspaceId: scope.workspaceId, userId: user.id } });
  if (!count) throw Errors.notFound();
}
