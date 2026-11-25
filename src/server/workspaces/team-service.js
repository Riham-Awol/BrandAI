import "server-only";
import { prisma } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import { logger } from "../logger.js";
import { getEnv } from "../config/env.js";
import { recordAudit, AUDIT_ACTIONS } from "../audit/service.js";
import { sendEmail } from "../email/index.js";
import { notify } from "../notifications/service.js";
import { enforceRateLimit } from "../rate-limit/index.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { verifyPassword } from "../auth/password.js";
import { generateToken, hashToken } from "../auth/tokens.js";
import { uuidSchema } from "@/validation/common.js";
import { assertPlanAllows, getEntitlements } from "../billing/entitlements.js";
import { PLANS } from "../billing/plans.js";
import { createWorkspaceForUser } from "./service.js";

const INVITE_TTL_DAYS = 7;
const MAX_OWNED_WORKSPACES = 10;
const ROLE_LABELS = { OWNER: "Owner", ADMIN: "Admin", EDITOR: "Editor", VIEWER: "Viewer" };

/** Workspace details and what this member may change. */
export async function getWorkspaceSettings(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_READ);
  const [ws, ent] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: scope.workspaceId }, select: { id: true, name: true, slug: true, type: true, createdAt: true, agencyWorkspaceId: true, owner: { select: { id: true, name: true, email: true } }, agency: { select: { name: true } } } }),
    getEntitlements(scope.workspaceId),
  ]);
  return {
    ...ws, role: scope.role, plan: ent.plan, planName: PLANS[ent.plan].name, isClient: ent.isClient,
    permissions: {
      canRename: scope.can(PERMISSIONS.WORKSPACE_UPDATE),
      canDelete: scope.can(PERMISSIONS.WORKSPACE_DELETE) && ws.type !== "PERSONAL",
      canTransfer: scope.can(PERMISSIONS.OWNERSHIP_TRANSFER) && ws.type !== "PERSONAL",
      canLeave: scope.role !== "OWNER",
    },
  };
}

export async function renameWorkspace(user, workspaceId, { name }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_UPDATE);
  await prisma.workspace.update({ where: { id: scope.workspaceId }, data: { name } });
  await recordAudit({ action: AUDIT_ACTIONS.WORKSPACE_UPDATED, actorId: user.id, workspaceId, entityType: "workspace", entityId: workspaceId, metadata: { name }, request });
  return getWorkspaceSettings(user, workspaceId);
}

/** A new team or agency workspace owned by the caller (starts on the Free plan). */
export async function createWorkspace(user, { name, type }, request) {
  const owned = await prisma.workspace.count({ where: { ownerId: user.id, deletedAt: null, agencyWorkspaceId: null } });
  if (owned >= MAX_OWNED_WORKSPACES) throw Errors.conflict(`You can own up to ${MAX_OWNED_WORKSPACES} workspaces.`);
  // createWorkspaceForUser records the audit entry.
  void request;
  return createWorkspaceForUser({ userId: user.id, name, type });
}

/**
 * Deletes a team/agency workspace (soft). Personal workspaces close with the
 * account. `beforeDelete` lets billing cancel a paid plan first.
 */
export async function deleteWorkspace(user, workspaceId, { confirmName }, request, { beforeDelete } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_DELETE);
  if (scope.workspace.type === "PERSONAL") throw Errors.conflict("Your personal workspace closes with your account.");
  if (confirmName.trim() !== scope.workspace.name) throw Errors.validation({ confirmName: ["Type the workspace name exactly."] });
  const clients = await prisma.workspace.count({ where: { agencyWorkspaceId: scope.workspaceId, deletedAt: null } });
  if (clients) throw Errors.conflict("Archive or hand over this agency's client workspaces first.");
  if (beforeDelete) await beforeDelete(scope.workspaceId);
  await prisma.workspace.update({ where: { id: scope.workspaceId }, data: { deletedAt: new Date() } });
  await recordAudit({ action: AUDIT_ACTIONS.WORKSPACE_DELETED, actorId: user.id, workspaceId, entityType: "workspace", entityId: workspaceId, request });
  return { deleted: true };
}

function presentInvite(i) {
  return { id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt, createdAt: i.createdAt, invitedBy: i.invitedBy?.name ?? null };
}

export async function listMembers(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.MEMBERS_READ);
  const canManage = scope.can(PERMISSIONS.MEMBERS_MANAGE);
  const [members, invites, ent] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { workspaceId: scope.workspaceId }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true, mfaEnabledAt: true } } } }),
    canManage ? prisma.workspaceInvitation.findMany({ where: { workspaceId: scope.workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, include: { invitedBy: { select: { name: true } } } }) : [],
    getEntitlements(scope.workspaceId),
  ]);
  return {
    members: members.map((m) => ({ id: m.id, userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role, joinedAt: m.createdAt, mfaEnabled: Boolean(m.user.mfaEnabledAt), isYou: m.user.id === user.id })),
    invitations: invites.map(presentInvite),
    seats: { used: members.length + invites.length, limit: PLANS[ent.plan].limits.members, plan: PLANS[ent.plan].name },
    permissions: { canManage, canManageAdmins: scope.can(PERMISSIONS.MEMBERS_MANAGE_ADMINS), canTransfer: scope.can(PERMISSIONS.OWNERSHIP_TRANSFER) && scope.workspace.type !== "PERSONAL" },
  };
}

function assertRoleGrant(scope, role) {
  if (role === "OWNER") throw Errors.validation({ role: ["Use “Transfer ownership” to change the owner."] });
  if (role === "ADMIN" && !scope.can(PERMISSIONS.MEMBERS_MANAGE_ADMINS)) throw Errors.forbidden("Only the owner can make someone an admin.");
}

/** Emails a 7-day invitation link. Counts against the plan's seats while pending. */
export async function inviteMember(user, workspaceId, { email, role }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.MEMBERS_MANAGE);
  if (scope.workspace.type === "PERSONAL") throw Errors.conflict("Personal workspaces are just for you. Create a team workspace to invite people.");
  assertRoleGrant(scope, role);
  await enforceRateLimit("invite", `user:${user.id}`);
  const existing = await prisma.workspaceMember.findFirst({ where: { workspaceId: scope.workspaceId, user: { email } }, select: { id: true } });
  if (existing) throw Errors.conflict("That person is already in this workspace.");
  // A new invitation to the same address replaces the old one (doesn't take a second seat).
  await prisma.workspaceInvitation.updateMany({ where: { workspaceId: scope.workspaceId, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  await assertPlanAllows(scope.workspaceId, "members");
  const { token, tokenHash } = generateToken();
  const invite = await prisma.workspaceInvitation.create({
    data: { workspaceId: scope.workspaceId, email, role, tokenHash, invitedById: user.id, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000) },
    include: { invitedBy: { select: { name: true } } },
  });
  const url = `${getEnv().APP_URL}/invite/${token}`;
  await sendEmail({
    to: email,
    subject: `${user.name} invited you to ${scope.workspace.name} on Brand AI`,
    text: `${user.name} invited you to join “${scope.workspace.name}” on Brand AI as ${ROLE_LABELS[role]}.\n\nAccept the invitation (valid for ${INVITE_TTL_DAYS} days):\n${url}\n\nIf you weren't expecting this, you can ignore this email.`,
  }).catch((error) => logger.warn("Invitation email failed", { error }));
  await recordAudit({ action: AUDIT_ACTIONS.MEMBER_INVITED, actorId: user.id, workspaceId, entityType: "invitation", entityId: invite.id, metadata: { email, role }, request });
  return presentInvite(invite);
}

export async function revokeInvitation(user, workspaceId, invitationId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.MEMBERS_MANAGE);
  if (!uuidSchema.safeParse(invitationId).success) throw Errors.notFound();
  const { count } = await prisma.workspaceInvitation.updateMany({ where: { id: invitationId, workspaceId: scope.workspaceId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!count) throw Errors.notFound();
  await recordAudit({ action: AUDIT_ACTIONS.INVITATION_REVOKED, actorId: user.id, workspaceId, entityType: "invitation", entityId: invitationId, request });
  return { revoked: true };
}

async function findInvitation(token) {
  const invite = await prisma.workspaceInvitation.findUnique({ where: { tokenHash: hashToken(String(token ?? "")) }, include: { workspace: { select: { id: true, name: true, type: true, deletedAt: true } }, invitedBy: { select: { name: true } } } });
  if (!invite || invite.workspace.deletedAt) return null;
  return invite;
}

function inviteState(invite) {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt <= new Date()) return "expired";
  return "pending";
}

/** Public view of an invitation (whoever holds the link). */
export async function getInvitation(token) {
  const invite = await findInvitation(token);
  if (!invite) throw Errors.notFound("This invitation link isn't valid.");
  return { workspace: invite.workspace.name, role: invite.role, roleLabel: ROLE_LABELS[invite.role], invitedBy: invite.invitedBy.name, email: invite.email, state: inviteState(invite) };
}

/** Joins the workspace. The signed-in account's email must match the invitation. */
export async function acceptInvitation(user, token, request) {
  const invite = await findInvitation(token);
  if (!invite) throw Errors.notFound("This invitation link isn't valid.");
  const state = inviteState(invite);
  if (state !== "pending") throw Errors.conflict(state === "expired" ? "This invitation has expired. Ask for a new one." : state === "revoked" ? "This invitation was cancelled." : "This invitation has already been used.");
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new AppError("FORBIDDEN", `This invitation is for ${invite.email}. Sign in with that email to accept it.`, 403);
  }
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.workspaceInvitation.updateMany({ where: { id: invite.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: new Date() } });
    if (consumed.count !== 1) throw Errors.conflict("This invitation has already been used.");
    await tx.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
      create: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role },
      update: {},
    });
    // Receiving the emailed link proves the address.
    await tx.user.updateMany({ where: { id: user.id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  });
  await recordAudit({ action: AUDIT_ACTIONS.MEMBER_JOINED, actorId: user.id, workspaceId: invite.workspaceId, entityType: "invitation", entityId: invite.id, metadata: { role: invite.role }, request });
  await notify({ userId: invite.invitedById, workspaceId: invite.workspaceId, type: "team.joined", title: `${user.name} joined ${invite.workspace.name}`, body: `as ${ROLE_LABELS[invite.role]}`, link: "/settings/members" });
  return { workspaceId: invite.workspaceId, workspace: invite.workspace.name };
}

async function findMember(scope, memberId) {
  if (!uuidSchema.safeParse(memberId).success) throw Errors.notFound();
  const m = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId: scope.workspaceId }, include: { user: { select: { id: true, name: true } } } });
  if (!m) throw Errors.notFound();
  return m;
}

export async function changeMemberRole(user, workspaceId, memberId, { role }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.MEMBERS_MANAGE);
  const m = await findMember(scope, memberId);
  if (m.userId === user.id) throw Errors.conflict("You can't change your own role.");
  if (m.role === "OWNER") throw Errors.conflict("The owner's role changes only through “Transfer ownership”.");
  assertRoleGrant(scope, role);
  if (m.role === "ADMIN" && !scope.can(PERMISSIONS.MEMBERS_MANAGE_ADMINS)) throw Errors.forbidden("Only the owner can change an admin's role.");
  await prisma.workspaceMember.update({ where: { id: m.id }, data: { role } });
  await recordAudit({ action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED, actorId: user.id, workspaceId, entityType: "member", entityId: m.userId, metadata: { from: m.role, to: role }, request });
  return { id: m.id, role };
}

export async function removeMember(user, workspaceId, memberId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.MEMBERS_MANAGE);
  const m = await findMember(scope, memberId);
  if (m.role === "OWNER") throw Errors.conflict("The owner can't be removed.");
  if (m.userId === user.id) throw Errors.conflict("Use “Leave workspace” to remove yourself.");
  if (m.role === "ADMIN" && !scope.can(PERMISSIONS.MEMBERS_MANAGE_ADMINS)) throw Errors.forbidden("Only the owner can remove an admin.");
  await prisma.workspaceMember.delete({ where: { id: m.id } });
  await recordAudit({ action: AUDIT_ACTIONS.MEMBER_REMOVED, actorId: user.id, workspaceId, entityType: "member", entityId: m.userId, metadata: { role: m.role }, request });
  return { removed: true };
}

export async function leaveWorkspace(user, workspaceId, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.WORKSPACE_READ);
  if (scope.role === "OWNER") throw Errors.conflict("Transfer ownership before leaving your workspace.");
  await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: scope.workspaceId, userId: user.id } } });
  await recordAudit({ action: AUDIT_ACTIONS.MEMBER_LEFT, actorId: user.id, workspaceId, entityType: "member", entityId: user.id, request });
  return { left: true };
}

/** Hands the workspace to another member (password required); the old owner becomes an admin. */
export async function transferOwnership(user, workspaceId, { memberId, password }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.OWNERSHIP_TRANSFER);
  if (scope.workspace.type === "PERSONAL") throw Errors.conflict("Personal workspaces can't be transferred.");
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!me?.passwordHash || !(await verifyPassword(password, me.passwordHash))) throw Errors.validation({ password: ["That password isn't right."] });
  const m = await findMember(scope, memberId);
  if (m.userId === user.id) throw Errors.conflict("You already own this workspace.");
  await prisma.$transaction([
    prisma.workspaceMember.update({ where: { id: m.id }, data: { role: "OWNER" } }),
    prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: scope.workspaceId, userId: user.id } }, data: { role: "ADMIN" } }),
    prisma.workspace.update({ where: { id: scope.workspaceId }, data: { ownerId: m.userId } }),
  ]);
  await recordAudit({ action: AUDIT_ACTIONS.WORKSPACE_TRANSFERRED, actorId: user.id, workspaceId, entityType: "workspace", entityId: workspaceId, metadata: { to: m.userId }, request });
  await notify({ userId: m.userId, workspaceId, type: "team.owner", title: `You now own ${scope.workspace.name}`, body: `${user.name} transferred ownership to you.`, link: "/settings/workspace" });
  return { ownerId: m.userId };
}

/** Workspace audit trail, newest first, with actor names (admins/owner). */
export async function listAuditLog(user, workspaceId, { action, before, take = 50 } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AUDIT_READ);
  const rows = await prisma.auditLog.findMany({
    where: { workspaceId: scope.workspaceId, ...(action ? { action: { startsWith: action } } : {}), ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(take, 100) + 1,
    select: { id: true, action: true, entityType: true, entityId: true, metadata: true, ipAddress: true, createdAt: true, actor: { select: { name: true, email: true } } },
  });
  const page = rows.slice(0, Math.min(take, 100));
  return { entries: page.map((r) => ({ ...r, actor: r.actor ? `${r.actor.name} (${r.actor.email})` : "System" })), nextBefore: rows.length > page.length ? page.at(-1).createdAt.toISOString() : null };
}
