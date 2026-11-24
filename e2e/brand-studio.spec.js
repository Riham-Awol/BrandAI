import { readFile } from "node:fs/promises";
import { expect, newUser, registerViaUi, test } from "./fixtures.js";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);

test.describe("Brand Identity Studio", () => {
  test.setTimeout(120_000);

  test("create → generate → select → customize logo → approve → brand hub → downloads → assets → guidelines", async ({ page }) => {
    await registerViaUi(page, newUser());
    const nav = (name) => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: new RegExp(name) });

    await page.goto("/brand/new");
    await page.getByLabel("Business name").fill("Crumb & Co");
    await page.getByRole("button", { name: "friendly" }).click();
    await expect(page.getByRole("button", { name: "friendly" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Start brand identity" }).click();
    await expect(page).toHaveURL(/\/brand\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Crumb & Co" })).toBeVisible();

    for (const title of ["Brand personality", "Brand voice", "Taglines", "Colour palette", "Typography", "Logo", "Brand guidelines"]) {
      await nav(title).click();
      await page.getByRole("button", { name: "Generate", exact: true }).click();
      await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible();
    }
    await expect(page.getByText("7 of 7 sections ready")).toBeVisible();

    // Pick the second palette and tagline.
    await nav("Colour palette").click();
    await expect(page.getByText("15.8:1")).toBeVisible();
    await page.getByRole("button", { name: "Select option 2" }).click();
    await expect(page.locator("li", { hasText: "Flour" }).getByText("Selected")).toBeVisible();
    await nav("Taglines").click();
    await page.getByRole("button", { name: "Select option 2" }).click();
    await expect(page.locator("li", { hasText: "Your neighbourhood loaf" }).getByText("Selected")).toBeVisible();

    // Logo: concepts render as images; customize the selected one.
    await nav("Logo").click();
    const conceptImg = page.getByRole("img", { name: "Warm Croissant logo concept" });
    await expect(conceptImg).toBeVisible();
    expect(await conceptImg.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Customize logo" }).click();
    await page.getByLabel("Shape").selectOption("hexagon");
    await page.getByLabel("Letter case").selectOption("upper");
    await expect(page.getByRole("img", { name: "Logo preview" })).toBeVisible();
    await page.getByRole("button", { name: "Save logo" }).click();
    await expect(page.getByRole("button", { name: "Customize logo" })).toBeVisible();
    await expect(page.getByRole("combobox").first().locator("option")).toHaveCount(2);

    // Approve.
    await nav("Review & approve").click();
    await expect(page.getByText("“Your neighbourhood loaf”")).toBeVisible();
    await page.getByRole("button", { name: "Approve brand identity" }).click();
    await expect(page.getByText("Brand identity version 1 approved.")).toBeVisible();

    // Brand hub: downloads.
    await page.getByRole("link", { name: "Open brand hub" }).click();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]{36}\/brand$/);
    await expect(page.getByText("Approved v1")).toBeVisible();
    const svgDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download Horizontal Colour SVG" }).click();
    const svgFile = await svgDownload;
    expect(svgFile.suggestedFilename()).toBe("crumb-co-logo-horizontal-color.svg");
    const svg = await readFile(await svgFile.path(), "utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Crumb &amp; Co logo");
    expect(svg).not.toContain("<script");

    const pngDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Stacked Mono PNG" }).click();
    const pngFile = await pngDownload;
    expect(pngFile.suggestedFilename()).toBe("crumb-co-logo-stacked-mono.png");
    const pngBytes = await readFile(await pngFile.path());
    expect(pngBytes.subarray(0, 4).toString("hex")).toBe("89504e47");

    // Asset library (database storage).
    await page.getByLabel("File").setInputFiles({ name: "shopfront.png", mimeType: "image/png", buffer: PNG });
    await page.getByLabel("Name", { exact: true }).fill("Shopfront photo");
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("Shopfront photo")).toBeVisible();
    await page.getByLabel("File").setInputFiles({ name: "evil.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg onload=alert(1)>") });
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("This file type is not allowed.")).toBeVisible();
    await page.getByRole("button", { name: "Delete Shopfront photo" }).click();
    await expect(page.getByText("No files yet.")).toBeVisible();

    // Guidelines.
    await page.getByRole("link", { name: "Brand guidelines" }).click();
    await expect(page.getByText("Brand guidelines · version 1")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Colour" })).toBeVisible();
    await expect(page.getByText("#3D5A80").first()).toBeVisible();
  });

  test("other workspaces cannot open or generate in a brand project", async ({ browser }) => {
    const ctxA = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.202.0.1" } });
    const a = await ctxA.newPage();
    await registerViaUi(a, newUser());
    await a.goto("/brand/new");
    await a.getByLabel("Business name").fill("Private Brand");
    await a.getByRole("button", { name: "Start brand identity" }).click();
    await expect(a).toHaveURL(/\/brand\/[0-9a-f-]{36}$/);
    const projectId = a.url().split("/").pop();

    const ctxB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.202.0.2" } });
    const b = await ctxB.newPage();
    await registerViaUi(b, newUser());
    const me = await (await b.request.get("/api/v1/me")).json();
    const wsB = me.data.workspaces[0].id;
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/brand-projects/${projectId}`)).status()).toBe(404);
    expect((await b.request.post(`/api/v1/workspaces/${wsB}/brand-projects/${projectId}/sections/personality/generate`, { data: {} })).status()).toBe(404);
    await b.goto(`/brand/${projectId}`);
    await expect(b.getByText("This page does not exist")).toBeVisible();
    await ctxA.close();
    await ctxB.close();
  });
});
