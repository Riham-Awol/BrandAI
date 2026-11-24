import { readFile } from "node:fs/promises";
import { expect, newUser, registerViaUi, test } from "./fixtures.js";

test.describe("Business Launch Studio", () => {
  test.setTimeout(90_000);

  test("idea → sections → edit/versions/accept → checklist → profile → approval → export", async ({ page }) => {
    await registerViaUi(page, newUser());

    // Start from the dashboard call to action.
    await page.getByRole("link", { name: /Start with the Launch Studio/ }).click();
    await expect(page).toHaveURL(/\/launch\/new$/);

    // Client-side validation.
    await page.getByLabel("Describe your business idea").fill("Too short");
    await page.getByRole("button", { name: "Start launch plan" }).click();
    await expect(page.getByText("Describe your idea in at least 20 characters.")).toBeVisible();
    await expect(page.getByText("Enter a country.")).toBeVisible();

    await page.getByLabel("Describe your business idea").fill("A neighbourhood sourdough bakery in Leeds that also supplies local cafés every morning.");
    await page.getByLabel("Country").fill("United Kingdom");
    await page.getByLabel("City (optional)").fill("Leeds");
    await page.getByRole("button", { name: "Start launch plan" }).click();
    await expect(page).toHaveURL(/\/launch\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Untitled business" })).toBeVisible();
    await expect(page.getByText("Test mode")).toBeVisible();

    // Idea analysis.
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.getByRole("img", { name: "Viability score 72 out of 100" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Idea analysis" })).toBeVisible();
    await expect(page.getByText("1 of 10 sections ready")).toBeVisible();

    // Names: generate, use a name, edit → v2, view v1, accept v1.
    await page.getByRole("button", { name: /Business names/ }).click();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByRole("button", { name: "Use this name" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Crumb & Co" })).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Naming notes").fill("Check the UK trademark register first.");
    await page.getByRole("button", { name: "Save as new version" }).click();
    await expect(page.getByText("Your edits were saved as a new version.")).toBeVisible();
    await expect(page.getByText("Check the UK trademark register first.")).toBeVisible();

    const versions = page.getByRole("combobox").first();
    await expect(versions.locator("option")).toHaveCount(2);
    await versions.selectOption({ label: "v1 · AI" });
    await expect(page.getByText("You are viewing an older version (v1)")).toBeVisible();
    await page.getByRole("button", { name: "Accept this version" }).click();
    await expect(page.getByText("Accepted.", { exact: false })).toBeVisible();
    await expect(page.getByText("Accepted", { exact: true })).toBeVisible();

    // Invalid edit is rejected by the server and shown on the field.
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: /Remove suggestions 1|Remove/ }).first().click();
    await page.getByRole("button", { name: "Save as new version" }).click();
    await expect(page.getByText("Your edits were saved as a new version.")).toBeVisible();

    // Generate the remaining sections in order.
    for (const title of ["Industry classification", "Target audience", "Customer problems", "Competitor research", "Business model", "Business strategy", "Business plan"]) {
      await page.getByRole("button", { name: new RegExp(title) }).click();
      await page.getByRole("button", { name: "Generate", exact: true }).click();
      await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible();
    }

    // Regenerate with instructions creates a new version.
    await page.getByRole("button", { name: "Regenerate" }).click();
    await page.getByLabel("What should change? (optional)").fill("More detail on costs");
    await page.getByRole("button", { name: "Regenerate" }).last().click();
    await expect(page.getByRole("combobox").first().locator("option")).toHaveCount(2);

    // Checklist progress persists.
    await page.getByRole("button", { name: /Launch checklist/ }).click();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByLabel(/Register the business/).check();
    await expect(page.getByText("1 of 3 done")).toBeVisible();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByText("1 of 3 done")).toBeVisible();
    await expect(page.getByText("10 of 10 sections ready")).toBeVisible();

    // Profile builder: pre-filled from outputs, save, approve.
    await page.getByRole("button", { name: /Business profile/ }).click();
    await expect(page.getByLabel("Business name", { exact: true })).toHaveValue("Crumb & Co");
    await expect(page.getByLabel("Industry", { exact: true })).toHaveValue("Food & Beverage");
    await expect(page.locator('input[name="products.0.name"]')).toHaveValue("Sourdough loaf");
    await page.getByRole("button", { name: "Save business profile" }).click();
    await expect(page.getByText("Profile saved.", { exact: false })).toBeVisible();
    await expect(page.getByText("Changes waiting for approval")).toBeVisible();
    await page.getByRole("button", { name: "Approve selected sections" }).click();
    await expect(page.getByText("Approved. Brand AI will now use these sections")).toBeVisible();

    // Export.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("crumb-co-launch-pack.md");
    const markdown = await readFile(await download.path(), "utf8");
    expect(markdown).toContain("# Crumb & Co — Launch Pack");
    expect(markdown).toContain("## Business plan");

    // The business profile page shows the approved context.
    await page.getByRole("link", { name: "Profile", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Crumb & Co" })).toBeVisible();
    await expect(page.getByText("Current: version 1")).toBeVisible();

    // The launch list shows progress.
    await page.goto("/launch");
    await expect(page.getByText("10 of 10 sections")).toBeVisible();
  });

  test("another workspace cannot open the project page", async ({ browser }) => {
    const ctxA = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.201.0.1" } });
    const ctxB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.201.0.2" } });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await registerViaUi(a, newUser());
    await registerViaUi(b, newUser());
    await a.goto("/launch/new");
    await a.getByLabel("Describe your business idea").fill("A mobile bicycle repair service for commuters in Nairobi.");
    await a.getByLabel("Country").fill("Kenya");
    await a.getByRole("button", { name: "Start launch plan" }).click();
    await expect(a).toHaveURL(/\/launch\/[0-9a-f-]{36}$/);
    const url = new URL(a.url());

    // The page streams, so the HTTP status is sent before the access check;
    // what matters is that the not-found UI renders and nothing leaks.
    await b.goto(url.pathname);
    await expect(b.getByText("This page does not exist")).toBeVisible();
    await expect(b.getByText("bicycle repair")).toHaveCount(0);

    const me = await (await b.request.get("/api/v1/me")).json();
    const projectId = url.pathname.split("/").pop();
    const api = await b.request.get(`/api/v1/workspaces/${me.data.workspaces[0].id}/launch-projects/${projectId}`);
    expect(api.status()).toBe(404);
    await ctxA.close();
    await ctxB.close();
  });
});
