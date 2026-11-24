import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { resolveSiteBrand } from "@/server/brand/approved-brand.js";
import { uuidSchema } from "@/validation/common.js";
import { computeTotals, taxBreakdown } from "./money.js";
import { TRANSITIONS, aiDocumentTextSchema, isOverdue } from "./documents.js";
import { documentTextInput, documentTextInstructions } from "./document-prompts.js";
import { loadDetails, presentDetails } from "./details-service.js";
import "./mock-fixtures.js";

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const toDate = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);

/** JSON-safe document (BigInt → string, dates → YYYY-MM-DD) with computed line amounts. */
function present(doc, extra = {}) {
  const computed = computeTotals(doc.lines, doc.currency);
  return {
    id: doc.id, businessId: doc.businessId, type: doc.type, number: doc.number, status: doc.status, customer: doc.customer,
    issueDate: day(doc.issueDate), dueDate: day(doc.dueDate), currency: doc.currency,
    lines: computed.lines.map((l) => ({ ...l, netMinor: l.netMinor.toString(), taxMinor: l.taxMinor.toString() })),
    taxes: taxBreakdown(computed.lines).map((t) => ({ rate: t.rate, amount: t.amount.toString() })),
    intro: doc.intro, notes: doc.notes, terms: doc.terms,
    subtotalMinor: doc.subtotalMinor.toString(), taxMinor: doc.taxMinor.toString(), totalMinor: doc.totalMinor.toString(),
    sourceQuoteId: doc.sourceQuoteId, sentAt: doc.sentAt, paidAt: doc.paidAt, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    overdue: isOverdue({ type: doc.type, status: doc.status, dueDate: day(doc.dueDate) }),
    business: doc.business ? { id: doc.business.id, name: doc.business.name } : undefined,
    ...extra,
  };
}

async function findDocument(scope, id) {
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const doc = await prisma.businessDocument.findFirst({ where: { id, workspaceId: scope.workspaceId, deletedAt: null }, include: { business: { select: { id: true, name: true, industry: true } } } });
  if (!doc) throw Errors.notFound();
  return doc;
}

/** Allocates the next number for a type inside a transaction (skips numbers already used). */
async function allocateNumber(tx, businessId, type) {
  const details = await tx.businessDetails.upsert({ where: { businessId }, create: { businessId }, update: {} });
  const prefix = type === "INVOICE" ? details.invoicePrefix : details.quotePrefix;
  let next = type === "INVOICE" ? details.nextInvoiceNumber : details.nextQuoteNumber;
  for (let i = 0; i < 1000; i++, next++) {
    const number = `${prefix}${String(next).padStart(4, "0")}`;
    const used = await tx.businessDocument.findFirst({ where: { businessId, type, number }, select: { id: true } });
    if (!used) {
      await tx.businessDetails.update({ where: { businessId }, data: type === "INVOICE" ? { nextInvoiceNumber: next + 1 } : { nextQuoteNumber: next + 1 } });
      return number;
    }
  }
  throw new AppError("CONFLICT", "Could not allocate a document number. Check the next number in Business details.", 409);
}

function totalsData(input) {
  const t = computeTotals(input.lines, input.currency);
  return { subtotalMinor: t.subtotalMinor, taxMinor: t.taxMinor, totalMinor: t.totalMinor };
}

const contentData = (input) => ({
  customer: input.customer, issueDate: toDate(input.issueDate), dueDate: toDate(input.dueDate), currency: input.currency,
  lines: input.lines.map(({ description, quantity, unitPrice, taxRate }) => ({ description, quantity, unitPrice, taxRate })),
  intro: input.intro ?? null, notes: input.notes ?? null, terms: input.terms ?? null, ...totalsData(input),
});

export async function listDocuments(user, workspaceId, { type } = {}) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const docs = await prisma.businessDocument.findMany({
    where: { workspaceId: scope.workspaceId, deletedAt: null, ...(type === "INVOICE" || type === "QUOTE" ? { type } : {}) },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], take: 300,
    include: { business: { select: { id: true, name: true } } },
  });
  return docs.map((d) => present(d));
}

export async function getDocument(user, workspaceId, id) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const doc = await findDocument(scope, id);
  return present(doc, { permissions: { canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE) }, transitions: TRANSITIONS[doc.type][doc.status] });
}

/** Defaults for a new document form: currency, tax rate and due date from business details. */
export async function getDocumentDefaults(user, workspaceId, businessId, type) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const business = await findScopedBusiness(scope, businessId);
  const d = presentDetails(await loadDetails(business.id), business);
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + (type === "QUOTE" ? 30 : d.paymentTermsDays) * 86400000).toISOString().slice(0, 10);
  return { currency: d.currency, taxRate: d.defaultTaxRate, issueDate: today, dueDate: due, detailsSaved: d.saved };
}

export async function createDocument(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const business = await findScopedBusiness(scope, input.businessId);
  const doc = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, business.id, input.type);
    return tx.businessDocument.create({ data: { workspaceId: scope.workspaceId, businessId: business.id, type: input.type, number, createdById: user.id, ...contentData(input) }, select: { id: true, number: true } });
  });
  await recordAudit({ action: `${input.type.toLowerCase()}.created`, actorId: user.id, workspaceId, entityType: "business_document", entityId: doc.id, metadata: { number: doc.number }, request });
  return getDocument(user, workspaceId, doc.id);
}

/** Only drafts can be edited — sent documents must be moved back to draft (audited) or voided. */
export async function updateDocument(user, workspaceId, id, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const doc = await findDocument(scope, id);
  if (doc.status !== "DRAFT") throw new AppError("CONFLICT", "Only drafts can be edited. Move it back to draft first.", 409);
  await prisma.businessDocument.update({ where: { id: doc.id }, data: contentData(input) });
  await recordAudit({ action: `${doc.type.toLowerCase()}.updated`, actorId: user.id, workspaceId, entityType: "business_document", entityId: doc.id, request });
  return getDocument(user, workspaceId, doc.id);
}

export async function setDocumentStatus(user, workspaceId, id, status, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const doc = await findDocument(scope, id);
  if (!TRANSITIONS[doc.type][doc.status].includes(status)) throw new AppError("CONFLICT", `A ${doc.status.toLowerCase()} ${doc.type === "QUOTE" ? "quotation" : "invoice"} can't be marked ${status.toLowerCase()}.`, 409);
  const data = { status };
  if (status === "SENT" && !doc.sentAt) data.sentAt = new Date();
  if (status === "PAID") data.paidAt = new Date();
  if (doc.status === "PAID" && status !== "PAID") data.paidAt = null;
  await prisma.businessDocument.update({ where: { id: doc.id }, data });
  await recordAudit({ action: `${doc.type.toLowerCase()}.status_changed`, actorId: user.id, workspaceId, entityType: "business_document", entityId: doc.id, metadata: { from: doc.status, to: status }, request });
  return getDocument(user, workspaceId, doc.id);
}

/** Creates a draft invoice from a quotation (and marks the quote accepted). */
export async function convertQuoteToInvoice(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const quote = await findDocument(scope, id);
  if (quote.type !== "QUOTE" || !["SENT", "ACCEPTED"].includes(quote.status)) throw new AppError("CONFLICT", "Only sent or accepted quotations can be turned into invoices.", 409);
  const existing = await prisma.businessDocument.findFirst({ where: { sourceQuoteId: quote.id, deletedAt: null }, select: { id: true } });
  if (existing) return getDocument(user, workspaceId, existing.id);
  const details = presentDetails(await loadDetails(quote.businessId), quote.business);
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + details.paymentTermsDays * 86400000).toISOString().slice(0, 10);
  const input = { customer: quote.customer, issueDate: today, dueDate: due, currency: quote.currency, lines: quote.lines, notes: quote.notes ?? undefined, terms: undefined, intro: undefined };
  const invoice = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, quote.businessId, "INVOICE");
    if (quote.status !== "ACCEPTED") await tx.businessDocument.update({ where: { id: quote.id }, data: { status: "ACCEPTED" } });
    return tx.businessDocument.create({ data: { workspaceId: quote.workspaceId, businessId: quote.businessId, type: "INVOICE", number, sourceQuoteId: quote.id, createdById: user.id, ...contentData(input) }, select: { id: true, number: true } });
  });
  await recordAudit({ action: "quote.converted", actorId: user.id, workspaceId, entityType: "business_document", entityId: quote.id, metadata: { invoiceId: invoice.id, number: invoice.number }, request });
  return getDocument(user, workspaceId, invoice.id);
}

export async function duplicateDocument(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const doc = await findDocument(scope, id);
  const today = new Date().toISOString().slice(0, 10);
  const shift = doc.dueDate ? Math.round((doc.dueDate - doc.issueDate) / 86400000) : null;
  const due = shift === null ? undefined : new Date(Date.now() + shift * 86400000).toISOString().slice(0, 10);
  return createDocument(user, workspaceId, { businessId: doc.businessId, type: doc.type, customer: doc.customer, issueDate: today, dueDate: due, currency: doc.currency, lines: doc.lines, intro: doc.intro ?? undefined, notes: doc.notes ?? undefined, terms: doc.terms ?? undefined }, request);
}

/** Drafts can be deleted; issued documents must be voided so numbering stays auditable. */
export async function deleteDocument(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const doc = await findDocument(scope, id);
  if (doc.status !== "DRAFT" || doc.sentAt) throw new AppError("CONFLICT", "Documents that were sent can't be deleted — mark them void instead.", 409);
  await prisma.businessDocument.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
  await recordAudit({ action: `${doc.type.toLowerCase()}.deleted`, actorId: user.id, workspaceId, entityType: "business_document", entityId: doc.id, request });
}

/** AI-written intro/notes/terms for the form (not saved; numbers are never written by AI). */
export async function draftDocumentText(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AI_GENERATE);
  const business = await findScopedBusiness(scope, input.businessId);
  const result = await generateText({
    user, workspaceId, businessId: business.id, module: "stationery", task: "document_text",
    instructions: documentTextInstructions(input.type),
    input: documentTextInput({ business, brief: input.brief, lines: input.lines, customerName: input.customerName }),
    schema: aiDocumentTextSchema, effort: "low", maxTokens: 1500, request,
  });
  const strip = (s) => String(s ?? "").trim();
  return { intro: input.type === "QUOTE" ? strip(result.data.intro) : "", notes: strip(result.data.notes), terms: strip(result.data.terms), isMock: result.isMock };
}

/** Everything the printable view needs (brand, details, computed document). */
export async function getPrintableDocument(user, workspaceId, id) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const doc = await findDocument(scope, id);
  const [brand, details] = await Promise.all([resolveSiteBrand(doc.businessId, doc.business), loadDetails(doc.businessId)]);
  return { document: present(doc), brand, details: presentDetails(details, doc.business) };
}

