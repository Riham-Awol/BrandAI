import { readFile } from "node:fs/promises";
import { expect, newUser, registerViaUi, test } from "./fixtures.js";

test.describe("Creative Design Studio", () => {
  test.setTimeout(120_000);

  test("brief → 3 options → save → edit with live preview → revisions → SVG/PNG export → gallery", async ({ page }) => {
    await registerViaUi(page, newUser());
    await page.goto("/design");
    await expect(page.getByText("No designs yet")).toBeVisible();
    await page.getByRole("link", { name: "New design" }).click();

    await page.getByRole("button", { name: "Event graphic" }).click();
    await expect(page.getByRole("button", { name: "Event graphic" })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Size").selectOption("square");
    await page.getByLabel("Business name").fill("Crust & Culture");
    await page.getByLabel("Brief").fill("Sourdough workshop at the bakery");
    await page.getByLabel("Facts to include (optional)").fill("Date: Sat 14 March");
    await page.getByRole("button", { name: "Generate 3 designs" }).click();

    await expect(page.getByRole("heading", { name: "Choose a design" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Design option \d/ })).toHaveCount(3);
    await expect(page.getByText(/no approved brand identity yet/)).toBeVisible();
    await expect(page.getByText("Mock", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Use this design" }).nth(2).click();

    await expect(page).toHaveURL(/\/design\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "[Mock] Bread class" })).toBeVisible();
    await expect(page.getByText("Event graphic · Crust & Culture · version 1")).toBeVisible();
    const preview = page.getByRole("img", { name: /^Preview:/ });
    await expect(preview).toHaveAttribute("src", /^data:image\/svg\+xml/);

    // Edit: live preview updates, save creates version 2.
    await page.getByLabel("Headline", { exact: true }).fill("Bake your own sourdough");
    await expect(page.getByRole("img", { name: "Preview: Bake your own sourdough" })).toBeVisible();
    await page.getByLabel("Template").selectOption("centered_badge");
    await page.getByLabel("Colours").selectOption("primary");
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Event graphic · Crust & Culture · version 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Saved" })).toBeDisabled();

    // Exports.
    const svgDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    const svg = await readFile(await (await svgDownload).path(), "utf8");
    expect(svg).toContain('viewBox="0 0 1080 1080"');
    expect(svg).toContain("<title>Bake your own sourdough</title>");
    const pngDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG" }).click();
    const png = await readFile(await (await pngDownload).path());
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1080);

    // Restore version 1.
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText("Event graphic · Crust & Culture · version 3")).toBeVisible();
    await expect(page.getByLabel("Headline", { exact: true })).toHaveValue("Learn to bake sourdough");

    // Gallery shows the design with a rendered thumbnail.
    await page.getByRole("link", { name: "All designs" }).click();
    await expect(page.getByRole("link", { name: "[Mock] Bread class" })).toBeVisible();
    await expect(page.getByText("Event graphic · Square · Crust & Culture")).toBeVisible();
    const thumb = page.locator("main img").first();
    await expect.poll(() => thumb.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test("other workspaces cannot open or render a design", async ({ browser }) => {
    const ctxA = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.205.0.1" } });
    const a = await ctxA.newPage();
    await registerViaUi(a, newUser());
    await a.goto("/design/new");
    await a.getByLabel("Business name").fill("Private Designs");
    await a.getByLabel("Brief").fill("Poster for a private event");
    await a.getByRole("button", { name: "Generate 3 designs" }).click();
    await a.getByRole("button", { name: "Use this design" }).first().click();
    await expect(a).toHaveURL(/\/design\/[0-9a-f-]{36}$/);
    const designId = a.url().split("/").pop();
    const wsA = (await (await a.request.get("/api/v1/me")).json()).data.workspaces[0].id;
    expect((await a.request.get(`/api/v1/workspaces/${wsA}/designs/${designId}/render`)).status()).toBe(200);

    const ctxB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.205.0.2" } });
    const b = await ctxB.newPage();
    await registerViaUi(b, newUser());
    const wsB = (await (await b.request.get("/api/v1/me")).json()).data.workspaces[0].id;
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/designs/${designId}`)).status()).toBe(404);
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/designs/${designId}/render`)).status()).toBe(404);
    expect((await b.request.get(`/api/v1/workspaces/${wsA}/designs/${designId}/render`)).status()).toBe(404);
    await b.goto(`/design/${designId}`);
    await expect(b.getByText("This page does not exist")).toBeVisible();
    await ctxA.close();
    await ctxB.close();
  });
});
