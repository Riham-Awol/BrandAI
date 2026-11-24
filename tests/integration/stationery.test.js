import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { setProviderOverrides } from "@/server/ai/providers/registry.js";
import { createMockTextProvider } from "@/server/ai/providers/mock.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import { createBusiness } from "@/server/businesses/service.js";
import { getBusinessDetails, saveBusinessDetails } from "@/modules/stationery/details-service.js";
import { businessDetailsSchema } from "@/modules/stationery/details.js";
import {
  deleteMaterial, duplicateMaterial, generateMaterialOptions, getMaterial, listMaterials, previewMaterial, renderMaterialView, restoreMaterialRevision, saveMaterial, updateMaterial,
} from "@/modules/stationery/materials-service.js";
import { materialBriefSchema, saveMaterialSchema } from "@/modules/stationery/schemas.js";
import {
  convertQuoteToInvoice, createDocument, deleteDocument, draftDocumentText, duplicateDocument, getDocument, getDocumentDefaults, getPrintableDocument, listDocuments, setDocumentStatus, updateDocument,
} from "@/modules/stationery/documents-service.js";
import { documentInputSchema, documentUpdateSchema } from "@/modules/stationery/documents.js";
import { createCompanyProfile, getPrintableProfile, listCompanyProfiles, profileEngine } from "@/modules/stationery/profile-service.js";
import { addMember, createUser } from "../helpers/factories.js";

let prompts;
beforeEach(() => {
  prompts = [];
  setProviderOverrides({ text: createMockTextProvider({ responder: (req) => (prompts.push(req), mockFixtureResponder(req)) }) });
});
afterEach(() => setProviderOverrides(null));

async function setup() {
  const owner = await createUser();
  const ws = owner.workspace.id;
  const biz = await createBusiness(owner.user, ws, { name: "Kirkgate Bakery", industry: "Bakery", stage: "STARTING" });
  return { owner, ws, biz };
}

const detailsInput = (over = {}) => businessDetailsSchema.parse({ legalName: "Kirkgate Bakery Ltd", addressLine1: "Kirkgate Market", city: "Leeds", postcode: "LS2 7HN", email: "hi@kirkgate.example", phone: "+44 113 000", currency: "GBP", defaultTaxRate: 20, paymentTermsDays: 30, invoicePrefix: "INV-", quotePrefix: "Q-", nextInvoiceNumber: 1, nextQuoteNumber: 1, bankDetails: "Sort code 00-00-00", ...over });
const doc = (ctx, over = {}) => documentInputSchema.parse({ businessId: ctx.biz.id, type: "INVOICE", customer: { name: "Café Leeds" }, issueDate: "2026-11-24", dueDate: "2026-12-24", currency: "GBP", lines: [{ description: "Loaves", quantity: "24", unitPrice: "4.50", taxRate: 20 }, { description: "Delivery", quantity: "1", unitPrice: "12", taxRate: 20 }], ...over });

describe("business details", () => {
  it("saves details, isolates workspaces and keeps viewers read-only", async () => {
    const ctx = await setup();
    expect((await getBusinessDetails(ctx.owner.user, ctx.ws, ctx.biz.id)).saved).toBe(false);
    const saved = await saveBusinessDetails(ctx.owner.user, ctx.ws, ctx.biz.id, detailsInput({ defaultTaxRate: 17.5 }));
    expect(saved).toMatchObject({ saved: true, legalName: "Kirkgate Bakery Ltd", defaultTaxRate: 17.5, currency: "GBP" });
    const other = await createUser();
    await expect(getBusinessDetails(other.user, other.workspace.id, ctx.biz.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    expect((await getBusinessDetails(viewer.user, ctx.ws, ctx.biz.id)).legalName).toBe("Kirkgate Bakery Ltd");
    await expect(saveBusinessDetails(viewer.user, ctx.ws, ctx.biz.id, detailsInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("branded materials", () => {
  it("offers card layouts without AI and merch concepts with AI, then saves, versions and renders", async () => {
    const ctx = await setup();
    await saveBusinessDetails(ctx.owner.user, ctx.ws, ctx.biz.id, detailsInput());
    const cards = await generateMaterialOptions(ctx.owner.user, ctx.ws, materialBriefSchema.parse({ businessId: ctx.biz.id, kind: "BUSINESS_CARD", person: { title: "Head Baker" } }));
    expect(prompts).toHaveLength(0);
    expect(cards.options).toHaveLength(3);
    expect(cards.options[0].spec.person).toMatchObject({ title: "Head Baker", phone: "+44 113 000", email: ctx.owner.user.email });
    expect(cards.options[0].views.map((v) => v.key)).toEqual(["front", "back"]);
    expect(cards.detailsSaved).toBe(true);

    const shirts = await generateMaterialOptions(ctx.owner.user, ctx.ws, materialBriefSchema.parse({ businessId: ctx.biz.id, kind: "TSHIRT", brief: "Staff tees" }));
    expect([prompts.at(-1).module, prompts.at(-1).task]).toEqual(["stationery", "materials"]);
    expect(prompts.at(-1).system).toContain("Never invent facts");
    expect(shirts.isMock).toBe(true);
    expect(shirts.options.map((o) => [o.spec.placement, o.spec.productColor])).toEqual([["left_chest", "white"], ["full_front", "black"], ["left_chest", "white"]]);
    expect(shirts.options[0].views.map((v) => v.key)).toEqual(["mockup", "artwork"]);

    let m = await saveMaterial(ctx.owner.user, ctx.ws, saveMaterialSchema.parse({ businessId: ctx.biz.id, kind: "TSHIRT", spec: shirts.options[1].spec, isMock: true }));
    expect(m).toMatchObject({ version: 1, kind: "TSHIRT", isMock: true, permissions: { canEdit: true } });
    m = await updateMaterial(ctx.owner.user, ctx.ws, m.id, { spec: { ...m.spec, slogan: "Proper bread", placement: "back" } });
    expect(m).toMatchObject({ version: 2, spec: { slogan: "Proper bread", placement: "back" } });
    m = await restoreMaterialRevision(ctx.owner.user, ctx.ws, m.id, 1);
    expect(m.version).toBe(3);
    expect(m.spec.placement).toBe("full_front");
    const { view } = await renderMaterialView(ctx.owner.user, ctx.ws, m.id, "artwork");
    expect(view.svg).toContain('width="300mm" height="400mm"');
    await expect(renderMaterialView(ctx.owner.user, ctx.ws, m.id, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const preview = await previewMaterial(ctx.owner.user, ctx.ws, { businessId: ctx.biz.id, kind: "MUG", spec: { ...m.spec, placement: "left_chest" } });
    expect(preview.views[1].widthMm).toBe(90); // invalid placement for a mug → its default ("front")
    const copy = await duplicateMaterial(ctx.owner.user, ctx.ws, m.id);
    expect(await listMaterials(ctx.owner.user, ctx.ws)).toHaveLength(2);
    await deleteMaterial(ctx.owner.user, ctx.ws, copy.id);
    expect(await listMaterials(ctx.owner.user, ctx.ws)).toHaveLength(1);
  });

  it("isolates materials and keeps viewers read-only", async () => {
    const ctx = await setup();
    const options = await generateMaterialOptions(ctx.owner.user, ctx.ws, materialBriefSchema.parse({ businessId: ctx.biz.id, kind: "LETTERHEAD" }));
    const m = await saveMaterial(ctx.owner.user, ctx.ws, saveMaterialSchema.parse({ businessId: ctx.biz.id, kind: "LETTERHEAD", spec: options.options[0].spec }));
    const other = await createUser();
    await expect(getMaterial(other.user, other.workspace.id, m.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(renderMaterialView(other.user, other.workspace.id, m.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(generateMaterialOptions(other.user, other.workspace.id, materialBriefSchema.parse({ businessId: ctx.biz.id, kind: "MUG" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    expect((await getMaterial(viewer.user, ctx.ws, m.id)).permissions.canEdit).toBe(false);
    await expect(updateMaterial(viewer.user, ctx.ws, m.id, { spec: m.spec })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(generateMaterialOptions(viewer.user, ctx.ws, materialBriefSchema.parse({ businessId: ctx.biz.id, kind: "MUG" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("invoices and quotations", () => {
  it("numbers documents, computes totals in code and locks sent documents", async () => {
    const ctx = await setup();
    await saveBusinessDetails(ctx.owner.user, ctx.ws, ctx.biz.id, detailsInput({ nextInvoiceNumber: 41 }));
    const defaults = await getDocumentDefaults(ctx.owner.user, ctx.ws, ctx.biz.id, "INVOICE");
    expect(defaults).toMatchObject({ currency: "GBP", taxRate: 20, detailsSaved: true });

    let inv = await createDocument(ctx.owner.user, ctx.ws, doc(ctx));
    expect(inv).toMatchObject({ number: "INV-0041", status: "DRAFT", subtotalMinor: "12000", taxMinor: "2400", totalMinor: "14400", taxes: [{ rate: 20, amount: "2400" }] });
    expect(inv.lines[0]).toMatchObject({ netMinor: "10800", taxMinor: "2160" });
    const second = await createDocument(ctx.owner.user, ctx.ws, doc(ctx));
    expect(second.number).toBe("INV-0042");

    inv = await updateDocument(ctx.owner.user, ctx.ws, inv.id, documentUpdateSchema.parse({ ...doc(ctx), lines: [{ description: "Loaves", quantity: "10", unitPrice: "4.50", taxRate: 0 }] }));
    expect(inv.totalMinor).toBe("4500");
    expect(inv.transitions).toEqual(["SENT", "VOID"]);
    inv = await setDocumentStatus(ctx.owner.user, ctx.ws, inv.id, "SENT");
    expect(inv.sentAt).not.toBeNull();
    await expect(updateDocument(ctx.owner.user, ctx.ws, inv.id, documentUpdateSchema.parse(doc(ctx)))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(setDocumentStatus(ctx.owner.user, ctx.ws, inv.id, "ACCEPTED")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(deleteDocument(ctx.owner.user, ctx.ws, inv.id)).rejects.toMatchObject({ code: "CONFLICT" });
    inv = await setDocumentStatus(ctx.owner.user, ctx.ws, inv.id, "PAID");
    expect(inv.paidAt).not.toBeNull();

    // A manually lowered counter skips numbers already used.
    await prisma.businessDetails.update({ where: { businessId: ctx.biz.id }, data: { nextInvoiceNumber: 41 } });
    expect((await createDocument(ctx.owner.user, ctx.ws, doc(ctx))).number).toBe("INV-0043");

    await deleteDocument(ctx.owner.user, ctx.ws, second.id);
    expect((await listDocuments(ctx.owner.user, ctx.ws, { type: "INVOICE" })).map((d) => d.number).sort()).toEqual(["INV-0041", "INV-0043"]);
    const printable = await getPrintableDocument(ctx.owner.user, ctx.ws, inv.id);
    expect(printable.details).toMatchObject({ legalName: "Kirkgate Bakery Ltd", bankDetails: "Sort code 00-00-00" });
  });

  it("turns an accepted quotation into a draft invoice once", async () => {
    const ctx = await setup();
    let quote = await createDocument(ctx.owner.user, ctx.ws, doc(ctx, { type: "QUOTE" }));
    expect(quote.number).toBe("QUO-0001");
    await expect(convertQuoteToInvoice(ctx.owner.user, ctx.ws, quote.id)).rejects.toMatchObject({ code: "CONFLICT" });
    quote = await setDocumentStatus(ctx.owner.user, ctx.ws, quote.id, "SENT");
    const invoice = await convertQuoteToInvoice(ctx.owner.user, ctx.ws, quote.id);
    expect(invoice).toMatchObject({ type: "INVOICE", status: "DRAFT", number: "INV-0001", sourceQuoteId: quote.id, totalMinor: quote.totalMinor });
    expect((await getDocument(ctx.owner.user, ctx.ws, quote.id)).status).toBe("ACCEPTED");
    expect((await convertQuoteToInvoice(ctx.owner.user, ctx.ws, quote.id)).id).toBe(invoice.id);
    const copy = await duplicateDocument(ctx.owner.user, ctx.ws, quote.id);
    expect(copy).toMatchObject({ type: "QUOTE", status: "DRAFT", number: "QUO-0002" });
  });

  it("drafts wording with AI but never numbers", async () => {
    const ctx = await setup();
    const text = await draftDocumentText(ctx.owner.user, ctx.ws, { businessId: ctx.biz.id, type: "QUOTE", brief: "Weekly bread", lines: ["Loaves"], customerName: "Café" });
    expect(text.intro).toContain("[Mock]");
    expect(prompts.at(-1).system).toContain("Never state prices, totals");
    expect(await prisma.businessDocument.count()).toBe(0);
    const invoiceText = await draftDocumentText(ctx.owner.user, ctx.ws, { businessId: ctx.biz.id, type: "INVOICE", lines: [] });
    expect(invoiceText.intro).toBe("");
  });

  it("isolates documents and keeps viewers read-only", async () => {
    const ctx = await setup();
    const inv = await createDocument(ctx.owner.user, ctx.ws, doc(ctx));
    const other = await createUser();
    await expect(getDocument(other.user, other.workspace.id, inv.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getPrintableDocument(other.user, other.workspace.id, inv.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createDocument(other.user, other.workspace.id, doc(ctx))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listDocuments(other.user, other.workspace.id)).toEqual([]);
    const viewer = await createUser();
    await addMember(ctx.ws, viewer.user.id, "VIEWER");
    expect((await getDocument(viewer.user, ctx.ws, inv.id)).permissions.canEdit).toBe(false);
    await expect(setDocumentStatus(viewer.user, ctx.ws, inv.id, "SENT")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(draftDocumentText(viewer.user, ctx.ws, { businessId: ctx.biz.id, type: "INVOICE", lines: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("company profile", () => {
  it("generates sections on the studio engine and assembles the brochure", async () => {
    const ctx = await setup();
    const project = await createCompanyProfile(ctx.owner.user, ctx.ws, { businessId: ctx.biz.id, purpose: "For cafés" });
    for (const s of ["overview", "offering", "closing"]) await profileEngine.generateSection(ctx.owner.user, ctx.ws, project.id, s);
    expect(prompts.map((p) => [p.module, p.task])).toEqual([["company_profile", "overview"], ["company_profile", "offering"], ["company_profile", "closing"]]);
    expect(prompts[0].system).toContain("Never invent facts");
    expect(prompts[0].prompt).toContain("<purpose>\nFor cafés");
    expect(prompts[1].prompt).toContain('<previous_result section="overview">');
    const printable = await getPrintableProfile(ctx.owner.user, ctx.ws, project.id);
    expect(printable).toMatchObject({ isMock: true, content: { overview: { headline: "[Mock] Real bread for real neighbourhoods" } } });
    expect(printable.content.offering.offerings).toHaveLength(2);
    expect(await listCompanyProfiles(ctx.owner.user, ctx.ws)).toHaveLength(1);
    const other = await createUser();
    await expect(getPrintableProfile(other.user, other.workspace.id, project.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
