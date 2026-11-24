import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { Errors } from "@/server/errors.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";

/**
 * One marketing calendar across studios: scheduled items, planned social posts
 * that are not scheduled yet, email campaigns, your reminders and invoice due dates.
 */
export async function getCalendar(user, workspaceId, { from, to }) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end - start > 100 * 86400000) throw Errors.validation({ range: ["Choose a range of up to 100 days."] });
  const ws = scope.workspaceId;
  const [items, posts, reminders, invoices] = await Promise.all([
    prisma.scheduledItem.findMany({ where: { workspaceId: ws, deletedAt: null, status: { not: "CANCELLED" }, scheduledAt: { gte: start, lt: end } }, select: { id: true, title: true, status: true, scheduledAt: true, sourceType: true, sourceId: true, integration: { select: { name: true } }, business: { select: { name: true } } } }),
    prisma.socialPost.findMany({ where: { workspaceId: ws, deletedAt: null, scheduledDate: { gte: new Date(start.toISOString().slice(0, 10)), lt: end } }, select: { id: true, title: true, status: true, scheduledDate: true, platform: true, projectId: true } }),
    prisma.reminder.findMany({ where: { workspaceId: ws, userId: user.id, dueAt: { gte: start, lt: end } }, select: { id: true, title: true, dueAt: true, doneAt: true, link: true } }),
    prisma.businessDocument.findMany({ where: { workspaceId: ws, deletedAt: null, type: "INVOICE", status: "SENT", dueDate: { gte: new Date(start.toISOString().slice(0, 10)), lt: end } }, select: { id: true, number: true, dueDate: true } }),
  ]);
  const scheduledPostIds = new Set(items.filter((i) => i.sourceType === "SOCIAL_POST").map((i) => i.sourceId));
  const events = [
    ...items.map((i) => ({ id: `item-${i.id}`, kind: i.sourceType === "EMAIL_CAMPAIGN" ? "email" : "scheduled", title: i.title, at: i.scheduledAt.toISOString(), allDay: false, status: i.status, detail: [i.business.name, i.integration?.name ?? (i.sourceType === "EMAIL_CAMPAIGN" ? "Email" : "Manual")].join(" · "), href: `/automation/queue#${i.id}` })),
    ...posts.filter((p) => !scheduledPostIds.has(p.id)).map((p) => ({ id: `post-${p.id}`, kind: "post", title: p.title, at: p.scheduledDate.toISOString().slice(0, 10), allDay: true, status: p.status, detail: `Planned ${p.platform.toLowerCase()} post — not scheduled`, href: `/social/${p.projectId}?section=posts` })),
    ...reminders.map((r) => ({ id: `rem-${r.id}`, kind: "reminder", title: r.title, at: r.dueAt.toISOString(), allDay: false, status: r.doneAt ? "DONE" : "OPEN", detail: "Reminder", href: r.link ?? "/automation/reminders" })),
    ...invoices.map((d) => ({ id: `inv-${d.id}`, kind: "invoice", title: `Invoice ${d.number} due`, at: d.dueDate.toISOString().slice(0, 10), allDay: true, status: "SENT", detail: "Payment due", href: `/stationery/documents/${d.id}` })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return { from: start.toISOString(), to: end.toISOString(), events };
}
