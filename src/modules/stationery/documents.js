import { z } from "zod";
import { currencyDecimals, parseDecimal } from "./money.js";

/** Invoice / quotation schemas and status rules (client-safe). */
export const DOCUMENT_TYPES = { INVOICE: "Invoice", QUOTE: "Quotation" };

export const STATUS_LABELS = { DRAFT: "Draft", SENT: "Sent", PAID: "Paid", ACCEPTED: "Accepted", DECLINED: "Declined", VOID: "Void" };

/** Allowed status changes. Only drafts can be edited. */
export const TRANSITIONS = {
  INVOICE: { DRAFT: ["SENT", "VOID"], SENT: ["PAID", "VOID", "DRAFT"], PAID: ["SENT"], VOID: [] },
  QUOTE: { DRAFT: ["SENT", "VOID"], SENT: ["ACCEPTED", "DECLINED", "VOID", "DRAFT"], ACCEPTED: ["SENT"], DECLINED: ["SENT"], VOID: [] },
};

const text = (max) => z.string().trim().max(max).optional().transform((v) => (v === "" ? undefined : v));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date.").refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "Invalid date.");

export const lineSchema = z.object({
  description: z.string().trim().min(1, "Describe the item.").max(300),
  quantity: z.string().trim().refine((q) => { const n = parseDecimal(q, 3); return n !== null && n > 0n; }, "Quantity like 1 or 2.5."),
  unitPrice: z.string().trim().max(20),
  taxRate: z.coerce.number().min(0).max(100),
});

const documentFields = z.object({
  customer: z.object({ name: z.string().trim().min(1, "Enter the customer's name.").max(160), company: text(160), email: z.union([z.email("Enter a valid email.").max(254), z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)), address: text(500), taxNumber: text(80) }),
  issueDate: isoDate,
  dueDate: isoDate.optional().or(z.literal("").transform(() => undefined)),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter code."),
  lines: z.array(lineSchema).min(1, "Add at least one line.").max(100),
  intro: text(2000),
  notes: text(2000),
  terms: text(2000),
});

function checkDocument(doc, ctx) {
  const d = currencyDecimals(doc.currency);
  doc.lines.forEach((l, i) => {
    if (parseDecimal(l.unitPrice, d) === null) ctx.addIssue({ code: "custom", path: ["lines", i, "unitPrice"], message: d === 0 ? "Whole amounts only for this currency." : `Price like 12.50 (max ${d} decimals).` });
  });
  if (doc.dueDate && doc.dueDate < doc.issueDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Must be on or after the issue date." });
}

export const documentInputSchema = documentFields.extend({ businessId: z.uuid(), type: z.enum(["INVOICE", "QUOTE"]) }).superRefine(checkDocument);

/** Saving a draft replaces its content. */
export const documentUpdateSchema = documentFields.superRefine(checkDocument);

export const statusSchema = z.object({ status: z.enum(["DRAFT", "SENT", "PAID", "ACCEPTED", "DECLINED", "VOID"]) });

export const draftTextSchema = z.object({
  businessId: z.uuid(),
  type: z.enum(["INVOICE", "QUOTE"]),
  brief: text(1500),
  lines: z.array(z.string().trim().max(300)).max(30).default([]),
  customerName: text(160),
});

export const aiDocumentTextSchema = z.object({
  intro: z.string().max(1200).describe("Short opening paragraph to the customer (quotes) or empty (invoices)."),
  notes: z.string().max(800).describe("A short thank-you or note."),
  terms: z.string().max(1500).describe("Plain-language terms without inventing figures."),
});

/** Is the document past its due date and still unpaid? */
export function isOverdue(doc, today = new Date().toISOString().slice(0, 10)) {
  return doc.type === "INVOICE" && doc.status === "SENT" && Boolean(doc.dueDate) && String(doc.dueDate).slice(0, 10) < today;
}
