import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { uuidSchema } from "@/validation/common.js";
import { contactsFromCsv } from "./email-render.js";

const token = () => randomBytes(32).toString("base64url");
const select = { id: true, businessId: true, email: true, name: true, consentSource: true, consentAt: true, unsubscribedAt: true, createdAt: true };
const MAX_IMPORT = 5000;

export async function listContacts(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  await findScopedBusiness(scope, businessId);
  const contacts = await prisma.emailContact.findMany({ where: { workspaceId: scope.workspaceId, businessId }, orderBy: { createdAt: "desc" }, take: 1000, select });
  const subscribed = await prisma.emailContact.count({ where: { workspaceId: scope.workspaceId, businessId, unsubscribedAt: null } });
  return { contacts, subscribed, total: await prisma.emailContact.count({ where: { workspaceId: scope.workspaceId, businessId } }) };
}

/** Adds one contact with recorded consent. Existing unsubscribed contacts are not re-subscribed silently. */
export async function addContact(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  await findScopedBusiness(scope, input.businessId);
  const existing = await prisma.emailContact.findUnique({ where: { businessId_email: { businessId: input.businessId, email: input.email } } });
  if (existing?.unsubscribedAt) throw new AppError("CONFLICT", "This person unsubscribed. They need to sign up again themselves.", 409);
  if (existing) throw new AppError("CONFLICT", "This email is already in your audience.", 409);
  const c = await prisma.emailContact.create({ data: { workspaceId: scope.workspaceId, businessId: input.businessId, email: input.email, name: input.name ?? null, consentSource: input.consentSource, consentAt: new Date(), unsubscribeToken: token() }, select });
  await recordAudit({ action: "audience.contact_added", actorId: user.id, workspaceId, entityType: "email_contact", entityId: c.id, request });
  return c;
}

/** CSV import (email + optional name). Duplicates and unsubscribed people are skipped. */
export async function importContacts(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  await findScopedBusiness(scope, input.businessId);
  const { contacts, invalid } = contactsFromCsv(input.csv);
  if (contacts.length > MAX_IMPORT) throw Errors.validation({ csv: [`Import up to ${MAX_IMPORT} contacts at a time.`] });
  const existing = new Set((await prisma.emailContact.findMany({ where: { businessId: input.businessId, email: { in: contacts.map((c) => c.email) } }, select: { email: true } })).map((c) => c.email));
  const fresh = contacts.filter((c) => !existing.has(c.email));
  const now = new Date();
  if (fresh.length) {
    await prisma.emailContact.createMany({ data: fresh.map((c) => ({ workspaceId: scope.workspaceId, businessId: input.businessId, email: c.email, name: c.name, consentSource: input.consentSource, consentAt: now, unsubscribeToken: token() })), skipDuplicates: true });
  }
  await recordAudit({ action: "audience.imported", actorId: user.id, workspaceId, entityType: "business", entityId: input.businessId, metadata: { added: fresh.length, skipped: contacts.length - fresh.length, invalid }, request });
  return { added: fresh.length, skipped: contacts.length - fresh.length, invalid };
}

export async function deleteContact(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const { count } = await prisma.emailContact.deleteMany({ where: { id, workspaceId: scope.workspaceId } });
  if (!count) throw Errors.notFound();
  await recordAudit({ action: "audience.contact_deleted", actorId: user.id, workspaceId, entityType: "email_contact", entityId: id, request });
}

/** Public unsubscribe (link or one-click POST). Idempotent; never reveals other data. */
export async function unsubscribeByToken(tokenValue) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(tokenValue))) return null;
  const c = await prisma.emailContact.findUnique({ where: { unsubscribeToken: tokenValue }, include: { business: { select: { name: true } } } });
  if (!c) return null;
  if (!c.unsubscribedAt) await prisma.emailContact.update({ where: { id: c.id }, data: { unsubscribedAt: new Date() } });
  return { businessName: c.business.name };
}

export async function lookupUnsubscribe(tokenValue) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(tokenValue))) return null;
  const c = await prisma.emailContact.findUnique({ where: { unsubscribeToken: tokenValue }, select: { unsubscribedAt: true, business: { select: { name: true } } } });
  return c ? { businessName: c.business.name, unsubscribed: Boolean(c.unsubscribedAt) } : null;
}
