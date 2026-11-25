import "server-only";
import { prisma } from "../db/prisma.js";
import { Errors } from "../errors.js";
import { recordAudit } from "../audit/service.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { periodStart } from "../usage/period.js";
import { uuidSchema } from "@/validation/common.js";
import { applyPlanLimits, assertPlanAllows, getEntitlements } from "../billing/entitlements.js";
import { PLANS } from "../billing/plans.js";
import { createWorkspaceForUser } from "./service.js";

/**
 * Agencies manage each client in a separate workspace (full data isolation
 * between clients). The client workspace is owned by the agency's owner, uses
 * the agency's plan and draws on the agency's AI credits. Client contacts are
 * invited into their own workspace only.
 */
async function agencyScope(user, workspaceId, permission) {
  const scope = await requireWorkspaceAccess(user, workspaceId, permission);
  if (scope.workspace.type !== "AGENCY") throw Errors.conflict("Client management is for agency workspaces.");
  return scope;
}

async function findClient(scope, clientId) {
  if (!uuidSchema.safeParse(clientId).success) throw Errors.notFound();
  const c = await prisma.agencyClient.findFirst({ where: { id: clientId, agencyWorkspaceId: scope.workspaceId }, include: { client: { select: { id: true, name: true } } } });
  if (!c) throw Errors.notFound();
  return c;
}

export async function listClients(user, workspaceId) {
  const scope = await agencyScope(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const since = periodStart("MONTHLY");
  const [clients, ent] = await Promise.all([
    prisma.agencyClient.findMany({
      where: { agencyWorkspaceId: scope.workspaceId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { client: { select: { id: true, name: true, _count: { select: { members: true, businesses: { where: { deletedAt: null } } } } } } },
    }),
    getEntitlements(scope.workspaceId),
  ]);
  const usage = clients.length
    ? await prisma.aiUsageRecord.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: clients.map((c) => c.clientWorkspaceId) }, createdAt: { gte: since } }, _count: { _all: true } })
    : [];
  const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id, workspaceId: { in: clients.map((c) => c.clientWorkspaceId) } }, select: { workspaceId: true } });
  const mine = new Set(memberships.map((m) => m.workspaceId));
  return {
    clients: clients.map((c) => ({
      id: c.id, workspaceId: c.clientWorkspaceId, name: c.client.name, status: c.status, contactName: c.contactName, contactEmail: c.contactEmail, notes: c.notes, createdAt: c.createdAt,
      members: c.client._count.members, businesses: c.client._count.businesses, aiRequestsThisMonth: usage.find((u) => u.workspaceId === c.clientWorkspaceId)?._count._all ?? 0, canOpen: mine.has(c.clientWorkspaceId),
    })),
    limit: PLANS[ent.plan].limits.clients, active: clients.filter((c) => c.status !== "ARCHIVED").length, plan: PLANS[ent.plan].name,
    canManage: scope.can(PERMISSIONS.CLIENTS_MANAGE),
  };
}

export async function createClient(user, workspaceId, input, request) {
  const scope = await agencyScope(user, workspaceId, PERMISSIONS.CLIENTS_MANAGE);
  const ent = await assertPlanAllows(scope.workspaceId, "clients");
  const agency = await prisma.workspace.findUnique({ where: { id: scope.workspaceId }, select: { ownerId: true } });
  const result = await prisma.$transaction(async (tx) => {
    const ws = await createWorkspaceForUser({ userId: agency.ownerId, name: input.name, type: "TEAM" }, tx);
    await tx.workspace.update({ where: { id: ws.id }, data: { agencyWorkspaceId: scope.workspaceId } });
    if (user.id !== agency.ownerId) await tx.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: "ADMIN" } });
    await applyPlanLimits(ws.id, ent.plan, tx);
    return tx.agencyClient.create({ data: { agencyWorkspaceId: scope.workspaceId, clientWorkspaceId: ws.id, contactName: input.contactName ?? null, contactEmail: input.contactEmail ?? null, notes: input.notes ?? null, createdById: user.id } });
  });
  await recordAudit({ action: "agency.client_created", actorId: user.id, workspaceId, entityType: "agency_client", entityId: result.id, metadata: { name: input.name, clientWorkspaceId: result.clientWorkspaceId }, request });
  return { id: result.id, workspaceId: result.clientWorkspaceId };
}

export async function updateClient(user, workspaceId, clientId, input, request) {
  const scope = await agencyScope(user, workspaceId, PERMISSIONS.CLIENTS_MANAGE);
  const c = await findClient(scope, clientId);
  if (input.status && input.status !== "ARCHIVED" && c.status === "ARCHIVED") await assertPlanAllows(scope.workspaceId, "clients");
  const data = { contactName: input.contactName, contactEmail: input.contactEmail, notes: input.notes, status: input.status };
  await prisma.$transaction([
    prisma.agencyClient.update({ where: { id: c.id }, data }),
    ...(input.name ? [prisma.workspace.update({ where: { id: c.clientWorkspaceId }, data: { name: input.name } })] : []),
    // Archived clients' workspaces are closed to everyone until restored.
    ...(input.status ? [prisma.workspace.update({ where: { id: c.clientWorkspaceId }, data: { suspendedAt: input.status === "ARCHIVED" ? new Date() : null } })] : []),
  ]);
  await recordAudit({ action: "agency.client_updated", actorId: user.id, workspaceId, entityType: "agency_client", entityId: c.id, metadata: { status: input.status }, request });
  return { id: c.id };
}

/** Gives the agency's admins and editors the same role in a client workspace (viewers stay out). */
export async function shareTeamWithClient(user, workspaceId, clientId, request) {
  const scope = await agencyScope(user, workspaceId, PERMISSIONS.CLIENTS_MANAGE);
  const c = await findClient(scope, clientId);
  const team = await prisma.workspaceMember.findMany({ where: { workspaceId: scope.workspaceId, role: { in: ["ADMIN", "EDITOR"] } }, select: { userId: true, role: true } });
  const existing = new Set((await prisma.workspaceMember.findMany({ where: { workspaceId: c.clientWorkspaceId }, select: { userId: true } })).map((m) => m.userId));
  const toAdd = team.filter((m) => !existing.has(m.userId));
  if (toAdd.length) await assertPlanAllows(c.clientWorkspaceId, "members", { adding: toAdd.length });
  await prisma.workspaceMember.createMany({ data: toAdd.map((m) => ({ workspaceId: c.clientWorkspaceId, userId: m.userId, role: m.role })), skipDuplicates: true });
  await recordAudit({ action: "agency.team_shared", actorId: user.id, workspaceId, entityType: "agency_client", entityId: c.id, metadata: { added: toAdd.length }, request });
  return { added: toAdd.length };
}
