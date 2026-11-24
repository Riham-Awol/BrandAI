import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { recordAudit } from "@/server/audit/service.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";

const DEFAULTS = { currency: "GBP", defaultTaxRateBp: 0, paymentTermsDays: 14, invoicePrefix: "INV-", quotePrefix: "QUO-", nextInvoiceNumber: 1, nextQuoteNumber: 1 };

/** Presents stored details for the UI/API (tax rate as a percentage). */
export function presentDetails(row, business) {
  const d = row ?? DEFAULTS;
  const { id: _id, businessId: _b, createdAt: _c, defaultTaxRateBp, ...rest } = d;
  return { ...DEFAULTS, ...rest, defaultTaxRate: (defaultTaxRateBp ?? 0) / 100, legalName: d.legalName ?? business?.name ?? "", saved: Boolean(row) };
}

/** Details for a business the caller already has access to (no auth here; callers authorize). */
export async function loadDetails(businessId) {
  return prisma.businessDetails.findUnique({ where: { businessId } });
}

export async function getBusinessDetails(user, workspaceId, businessId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const business = await findScopedBusiness(scope, businessId);
  return presentDetails(await loadDetails(business.id), business);
}

export async function saveBusinessDetails(user, workspaceId, businessId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, businessId);
  const { defaultTaxRate, ...rest } = input;
  const data = { ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v ?? null])), defaultTaxRateBp: Math.round(defaultTaxRate * 100) };
  const row = await prisma.businessDetails.upsert({ where: { businessId: business.id }, create: { businessId: business.id, ...data }, update: data });
  await recordAudit({ action: "business.details_updated", actorId: user.id, workspaceId, entityType: "business", entityId: business.id, request });
  return presentDetails(row, business);
}
