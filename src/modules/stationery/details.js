import { z } from "zod";

const text = (max) => z.string().trim().max(max).optional().transform((v) => (v === "" ? undefined : v));

/** Common ISO 4217 currencies offered in the UI (any 3-letter code is accepted by the API). */
export const CURRENCIES = ["GBP", "EUR", "USD", "CAD", "AUD", "NZD", "ZAR", "NGN", "KES", "GHS", "AED", "SAR", "INR", "PKR", "SGD", "JPY", "CHF", "SEK", "NOK", "DKK", "PLN", "BRL", "MXN"];

/** Company details used on stationery, invoices and quotations (client-safe). */
export const businessDetailsSchema = z.object({
  legalName: text(200),
  addressLine1: text(200),
  addressLine2: text(200),
  city: text(120),
  postcode: text(40),
  country: text(120),
  email: z.union([z.email("Enter a valid email.").max(254), z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
  phone: text(40),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => !v || /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v), "Enter a website like www.example.com."),
  registrationNumber: text(80),
  taxNumber: text(80),
  bankDetails: text(1000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code like GBP."),
  defaultTaxRate: z.coerce.number().min(0, "0–100%").max(100, "0–100%"),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  invoicePrefix: z.string().trim().max(12).regex(/^[A-Za-z0-9\-/]*$/, "Letters, numbers, - and / only."),
  quotePrefix: z.string().trim().max(12).regex(/^[A-Za-z0-9\-/]*$/, "Letters, numbers, - and / only."),
  nextInvoiceNumber: z.coerce.number().int().min(1).max(9_999_999),
  nextQuoteNumber: z.coerce.number().int().min(1).max(9_999_999),
});

/** Address lines as printed (empty parts removed). Pure. */
export function addressLines(d) {
  if (!d) return [];
  return [d.addressLine1, d.addressLine2, [d.city, d.postcode].filter(Boolean).join(" "), d.country].filter(Boolean);
}

export function websiteLabel(url) {
  return url ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
}
