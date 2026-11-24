# Phase 7 — AI Business Stationery & Merchandise Studio

Status: COMPLETE (awaiting approval)

## 1. Scope
Hub at `/stationery` with three parts sharing one **Business details** record (legal name, address, contact,
company and tax numbers, payment details, currency, default tax rate, payment terms, document numbering).

**Branded materials** (`brand_materials`) — drawn as vector artwork by code from validated specs with the approved
brand (logo, palette, fonts); neutral fallback without an approved identity:
| Kind | Output | Options |
|---|---|---|
| Business card | front + back print files, 85 × 55 mm + 3 mm bleed | 3 templates (no AI) |
| Letterhead | A4 print file (header, rule, legal footer) | 3 templates (no AI) |
| T-shirt, uniform polo, tote bag, mug | product mockup + transparent print artwork at real size | AI concepts: product colour, artwork (logo / symbol / name / slogan / symbol+slogan / icon pattern), placement, slogan |
| Product label | round / rectangle / hang-tag print file with cut guide | AI copy (name, descriptor, tagline); facts only from the brief |
| Packaging | tuck-end box dieline (cut red, fold blue) + 3D mockup; 3 sizes | AI copy incl. back-of-pack text |

Editor: live preview of every view, kind-specific fields, versions with restore, duplicate, delete; exports SVG,
PNG (300 dpi for print files), Print / Save as PDF at the physical page size. Merch inks are chosen to contrast
with the product colour (≥ 3:1); full-colour logos are used only where they read.

**Invoices & quotations** (`business_documents`) — sequential numbering per business (prefixes and next numbers
configurable; numbers already used are skipped), customer, dates, currency, line items with tax rates. **All
amounts are computed in code** with integer minor units (BigInt), quantities in thousandths, half-up rounding per
line; stored totals are recomputed on every save. Status flow: Draft → Sent → Paid (invoices) / Accepted /
Declined (quotes), Void; only drafts are editable; sent documents can't be deleted. Quote → invoice conversion
(idempotent). "Write with AI" drafts intro, terms and notes — never numbers. Printable A4 page with the brand,
company details, payment details and payment reference.

**Company profile** — studio-engine project (`COMPANY_PROFILE`) with three AI sections (overview; offering, why
choose us, process; promise & contact), versions/accept/edit like other studios, and a printable branded A4
brochure (cover + 3 pages). The AI is told not to invent founding years, clients, awards or statistics.

Out of scope: sending documents by email and payment links (Phase 8 approvals/integrations), print-shop ordering
(paid service), freehand artwork editing, non-Latin fonts.

## 2. Database — migration `phase7_stationery`
`business_details` (1:1 business), `brand_materials` + `brand_material_revisions`, `business_documents`
(BigInt minor-unit totals, unique number per business and type); `ProjectType.COMPANY_PROFILE`; enums
`MaterialKind`, `DocumentType`, `DocumentStatus`.

## 3. Acceptance criteria
- [x] Business cards, letterheads, company profiles, invoices, quotations, T-shirts, uniforms, bags, mugs,
      product labels and packaging designs, all in the approved brand.
- [x] Print-ready exports at physical size (bleed for cards; dieline for packaging; 300 dpi PNG).
- [x] Document numbers and totals computed in code; status rules enforced; quote → invoice.
- [x] AI suggests concepts and wording only; no invented facts or numbers; mock fixtures for every AI task.
- [x] Workspace isolation and viewer read-only tested; 390 px and dark mode; regression passes.

## 4. Tests
| Suite | New in Phase 7 |
|---|---|
| Unit (`stationery.test.js`, `stationery-text-fit.test.js`) | money maths (rounding, currencies, formatting), document validation and status rules, details, spec normalization, every kind × template/placement rendered at physical size, card bleed and escaping, merch ink contrast, fixtures, long-name fitting — 14 |
| Integration (`stationery.test.js`) | details + roles; materials (templates vs AI, save/version/restore/render/duplicate/delete, isolation, viewer); documents (numbering incl. skips, totals, locking, transitions, deletion rules, quote → invoice, AI wording without numbers, isolation, viewer); company profile — 8 |
| E2E | full stationery flow with SVG export, invoice → sent → print, quote → invoice; company profile → brochure; cross-workspace 404; mobile — 4 |
