import { readFile } from "node:fs/promises";
import { expect, newUser, registerViaUi, test } from "./fixtures.js";

test.describe("Marketing Strategy Studio", () => {
  test.setTimeout(120_000);

  test("create → generate all → budget chart & over-budget warning → approve → approved plan → exports", async ({ page }) => {
    await registerViaUi(page, newUser());
    const nav = (name) => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: new RegExp(name) });

    await page.goto("/strategy/new");
    await page.getByLabel("Business name").fill("Crust & Culture");
    await page.getByLabel("Main goal").selectOption("launch");
    await page.getByLabel("Monthly budget").fill("400");
    await page.getByLabel("Currency").selectOption("GBP");
    await page.getByRole("button", { name: "Start marketing strategy" }).click();
    await expect(page).toHaveURL(/\/strategy\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Launch the business · 6 months · 400 GBP/month")).toBeVisible();

    for (const title of ["Customer personas", "Competitor analysis", "Marketing channels", "Campaign objectives", "Budget", "Advertising strategy", "KPIs", "Marketing strategy"]) {
      await nav(`^\\S*\\s*${title}|${title}$`).first().click();
      await page.getByRole("button", { name: "Generate", exact: true }).click();
      await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible();
    }
    await expect(page.getByText("8 of 8 sections ready")).toBeVisible();

    await nav("Customer personas").click();
    await expect(page.getByRole("heading", { name: "Commuter Chloe" })).toBeVisible();

    // Budget: computed totals, chart with accessible bars, over-budget warning (500 > 400).
    await nav("Budget").click();
    await expect(page.getByText("£500").first()).toBeVisible();
    await expect(page.getByLabel("Instagram ads: £300 per month, 60%")).toBeVisible();
    await expect(page.getByText(/above your stated budget of £400\/month/)).toBeVisible();
    await page.getByLabel("Instagram ads: £300 per month, 60%").focus();
    await expect(page.getByRole("tooltip")).toContainText("Instagram ads");

    // Edit the budget to fit: warning disappears and totals recompute.
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Monthly amount").first().fill("200");
    await page.getByRole("button", { name: "Save as new version" }).click();
    await expect(page.getByText("Your edits were saved as a new version.")).toBeVisible();
    await expect(page.getByText(/above your stated budget/)).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "£400" })).toBeVisible();

    // Review, export, approve.
    await nav("Review & approve").click();
    await expect(page.getByText("8 of 8")).toBeVisible();
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Budget (CSV)" }).click();
    const csv = await readFile(await (await csvDownload).path(), "utf8");
    expect(csv.split("\r\n")[0]).toBe("Channel,Monthly (GBP),Share %,Purpose");
    expect(csv).toContain("Total,400,100,");
    await page.getByRole("button", { name: "Approve marketing plan" }).click();
    await expect(page.getByText("Marketing plan version 1 approved.")).toBeVisible();

    await page.getByRole("link", { name: "Open the approved plan" }).click();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]{36}\/marketing$/);
    await expect(page.getByText("Marketing plan · version 1")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Marketing strategy", level: 2 })).toBeVisible();
    const mdDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Markdown" }).click();
    const md = await readFile(await (await mdDownload).path(), "utf8");
    expect(md).toContain("# Crust & Culture — Marketing Plan (v1)");
  });

  test("other workspaces cannot reach the strategy project or approved plan", async ({ browser }) => {
    const ctxA = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.203.0.1" } });
    const a = await ctxA.newPage();
    await registerViaUi(a, newUser());
    await a.goto("/strategy/new");
    await a.getByLabel("Business name").fill("Private Co");
    await a.getByRole("button", { name: "Start marketing strategy" }).click();
    await expect(a).toHaveURL(/\/strategy\/[0-9a-f-]{36}$/);
    const projectId = a.url().split("/").pop();

    const ctxB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.203.0.2" } });
    const b = await ctxB.newPage();
    await registerViaUi(b, newUser());
    const wsB = (await (await b.request.get("/api/v1/me")).json()).data.workspaces[0].id;
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/strategy-projects/${projectId}`)).status()).toBe(404);
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/strategy-projects/${projectId}/export?format=markdown`)).status()).toBe(404);
    await b.goto(`/strategy/${projectId}`);
    await expect(b.getByText("This page does not exist")).toBeVisible();
    await ctxA.close();
    await ctxB.close();
  });
});
