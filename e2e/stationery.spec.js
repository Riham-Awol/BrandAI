import { readFile } from "node:fs/promises";
import { expect, newUser, registerViaUi, test } from "./fixtures.js";

test.describe("Stationery & Merchandise", () => {
  test.setTimeout(150_000);

  test("business details → business card (SVG export) → T-shirt concepts → invoice → sent → print → quote → invoice", async ({ page }) => {
    await registerViaUi(page, newUser());

    // Business card from templates.
    await page.goto("/stationery/materials/new?kind=BUSINESS_CARD");
    await page.getByLabel("Business name").fill("Kirkgate Bakery");
    await page.getByLabel("Job title").fill("Head Baker");
    await page.getByRole("button", { name: "Show 3 layouts" }).click();
    await expect(page.getByRole("img", { name: /^Option \d: / })).toHaveCount(3);
    await page.getByRole("link", { name: "Business details" }).click();

    // Business details.
    await page.getByLabel("Address line 1").fill("Kirkgate Market, Unit 4");
    await page.getByLabel("City").fill("Leeds");
    await page.getByLabel("Default tax rate (%)").fill("20");
    await page.getByLabel(/Payment details/).fill("Sort code 00-00-00");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Business details saved.")).toBeVisible();

    await page.goto("/stationery/materials/new?kind=BUSINESS_CARD");
    await page.getByRole("button", { name: "Show 3 layouts" }).click();
    await page.getByRole("button", { name: "Use this design" }).nth(1).click();
    await expect(page).toHaveURL(/\/stationery\/materials\/[0-9a-f-]{36}$/);
    await page.getByLabel("Phone").fill("+44 113 496 0000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Business card · Kirkgate Bakery · version 2")).toBeVisible();
    await page.getByRole("tab", { name: "Back" }).click();
    const svgDl = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    const svg = await readFile(await (await svgDl).path(), "utf8");
    expect(svg).toContain('width="91mm" height="61mm"');

    // T-shirt concepts (AI, mock provider in tests).
    await page.goto("/stationery/materials/new?kind=TSHIRT");
    await page.getByRole("button", { name: "Suggest 3 designs" }).click();
    await expect(page.getByRole("heading", { name: "Choose a design" })).toBeVisible();
    await page.getByRole("button", { name: "Use this design" }).nth(1).click();
    await page.getByRole("tab", { name: "Print artwork" }).click();
    await expect(page.getByText("Print file: 300 × 400 mm · PNG at 300 dpi")).toBeVisible();

    // Invoice with computed totals.
    await page.goto("/stationery/documents/new?type=INVOICE");
    await page.getByLabel("Name", { exact: true }).fill("Café Leeds");
    await page.getByLabel("Item 1 description").fill("Country loaves");
    await page.getByLabel("Item 1 quantity").fill("24");
    await page.getByLabel("Item 1 unit price").fill("4.50");
    await expect(page.getByLabel("Item 1 tax rate (%)")).toHaveValue("20");
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Item 2 description").fill("Delivery");
    await page.getByLabel("Item 2 unit price").fill("12");
    await expect(page.getByTestId("doc-total")).toHaveText("£144.00");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: "Invoice INV-0001" })).toBeVisible();
    await page.getByRole("button", { name: "Mark as sent" }).click();
    await expect(page.getByText("Sent", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Item 1 description")).toBeDisabled();
    const invoiceUrl = page.url();
    await page.goto(invoiceUrl.replace("/stationery/documents/", "/print/documents/"));
    await expect(page.getByRole("heading", { name: "Invoice" })).toBeVisible();
    await expect(page.getByText("Please use INV-0001 as the payment reference.")).toBeVisible();
    await expect(page.locator("dd").filter({ hasText: "£144.00" }).first()).toBeVisible();

    // Quotation → invoice.
    await page.goto("/stationery/documents/new?type=QUOTE");
    await page.getByLabel("Name", { exact: true }).fill("Market Café");
    await page.getByLabel("Item 1 description").fill("Weekly bread");
    await page.getByLabel("Item 1 unit price").fill("80");
    await page.getByRole("button", { name: "Write with AI" }).click();
    await expect(page.getByLabel("Introduction")).toHaveValue(/\[Mock\]/);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: "Quotation QUO-0001" })).toBeVisible();
    await page.getByRole("button", { name: "Mark as sent" }).click();
    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoice INV-0002" })).toBeVisible();
    await expect(page.getByRole("link", { name: "From quotation" })).toBeVisible();

    // Hub lists everything.
    await page.goto("/stationery");
    await expect(page.getByText("Business card · Kirkgate Bakery")).toBeVisible();
    await expect(page.getByRole("link", { name: /Invoice INV-0002/ })).toBeVisible();
  });

  test("company profile: generate sections and print the brochure", async ({ page }) => {
    await registerViaUi(page, newUser());
    await page.goto("/stationery/profiles/new");
    await page.getByLabel("Business name").fill("Kirkgate Bakery");
    await page.getByRole("button", { name: "Start company profile" }).click();
    await expect(page).toHaveURL(/\/stationery\/profiles\/[0-9a-f-]{36}/);
    const nav = (name) => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: new RegExp(name) });
    for (const s of ["Company overview", "What we offer", "Promise & contact"]) {
      await nav(s).click();
      await page.getByRole("button", { name: "Generate", exact: true }).click();
      await expect(page.getByRole("button", { name: /Regenerate/ })).toBeVisible();
    }
    await nav("Brochure").click();
    await expect(page.getByRole("heading", { level: 1, name: "[Mock] Real bread for real neighbourhoods" })).toBeVisible();
    const id = page.url().split("/").pop().split("?")[0];
    await page.goto(`/print/profiles/${id}`);
    await expect(page.getByText("Contains mock (test) content.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Why choose us" })).toBeVisible();
  });

  test("other workspaces cannot open documents or materials", async ({ browser }) => {
    const ctxA = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.208.0.1" } });
    const a = await ctxA.newPage();
    await registerViaUi(a, newUser());
    await a.goto("/stationery/documents/new?type=INVOICE");
    await a.getByLabel("Business name").fill("Private Co");
    await a.getByLabel("Name", { exact: true }).fill("Customer");
    await a.getByLabel("Item 1 description").fill("Work");
    await a.getByLabel("Item 1 unit price").fill("100");
    await a.getByRole("button", { name: "Create" }).click();
    await expect(a).toHaveURL(/\/stationery\/documents\/[0-9a-f-]{36}$/);
    const docId = a.url().split("/").pop();

    const ctxB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.208.0.2" } });
    const b = await ctxB.newPage();
    await registerViaUi(b, newUser());
    const wsB = (await (await b.request.get("/api/v1/me")).json()).data.workspaces[0].id;
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/documents/${docId}`)).status()).toBe(404);
    await b.goto(`/print/documents/${docId}`);
    await expect(b.getByText("This page does not exist")).toBeVisible();
    await ctxA.close();
    await ctxB.close();
  });
});
