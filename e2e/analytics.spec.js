import { expect, newUser, registerViaUi, test } from "./fixtures.js";

// A regular desktop browser user agent: Playwright's default ("HeadlessChrome") is filtered out as a bot.
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

async function workspaceId(page) {
  return (await (await page.request.get("/api/v1/me")).json()).data.workspaces[0].id;
}

test.describe("Analytics & Insights", () => {
  test.setTimeout(150_000);

  test("site visits → dashboard → post results → AI insights → exports → saved report → tracking settings", async ({ page, browser }) => {
    await registerViaUi(page, newUser());
    const ws = await workspaceId(page);

    // Empty workspace: a clear next step instead of zeros.
    await page.goto("/analytics");
    await expect(page.getByText("Create a business first.")).toBeVisible();

    // Publish a template site.
    await page.goto("/websites/new");
    await page.getByLabel("Business name").fill("Kirkgate Bakery");
    await page.getByRole("button", { name: "Start from template" }).click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published. Your website is live.")).toBeVisible();
    const livePath = await page.getByRole("link", { name: "View live site" }).getAttribute("href");

    // Two visitors (a bot doesn't count; a GPC browser doesn't count).
    const visit = async (ua, path, headers = {}) => {
      const ctx = await browser.newContext({ userAgent: ua, extraHTTPHeaders: { "x-forwarded-for": `10.77.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`, ...headers } });
      const v = await ctx.newPage();
      const pixel = v.waitForResponse((r) => r.url().includes("/px?"));
      await v.goto(path);
      expect((await pixel).headers()["content-type"]).toBe("image/gif");
      return { ctx, v };
    };
    const first = await visit(CHROME, `${livePath}?utm_source=flyer`);
    const pixel2 = first.v.waitForResponse((r) => r.url().includes("/px?"));
    await first.v.goto(livePath);
    await pixel2;
    await first.ctx.close();
    await (await visit("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", livePath)).ctx.close();
    await (await visit("Googlebot/2.1 (+http://www.google.com/bot.html)", livePath)).ctx.close();
    await (await visit(CHROME, livePath, { "sec-gpc": "1" })).ctx.close();

    // A post published manually, so results can be entered.
    const biz = (await (await page.request.get(`/api/v1/workspaces/${ws}/businesses`)).json()).data[0];
    const item = (await (await page.request.post(`/api/v1/workspaces/${ws}/automation/items`, { data: { businessId: biz.id, sourceType: "CUSTOM", text: "Seeded rye is back", scheduledAt: new Date(Date.now() - 60000).toISOString(), submit: true } })).json()).data;
    await page.request.post(`/api/v1/workspaces/${ws}/automation/run`);
    expect((await page.request.post(`/api/v1/workspaces/${ws}/automation/items/${item.id}/posted`, { data: { externalUrl: "" } })).ok()).toBe(true);

    await page.goto("/analytics");
    const tile = (label) => page.getByTestId("kpi-tile").filter({ has: page.getByText(label, { exact: true }) }).first();
    await expect(tile("Visitors")).toContainText("2");
    await expect(tile("Page views")).toContainText("3");
    await expect(page.getByText("flyer (campaign link)", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: /Visitors and page views per day/ })).toBeVisible();
    await page.getByRole("button", { name: "Show table" }).click();
    await expect(page.getByRole("table", { name: "Visitors and page views per day" })).toContainText("Total");
    await expect(page.getByText("No post results entered yet.", { exact: false })).toBeVisible();

    // Period filter keeps the URL in sync.
    await page.getByRole("radio", { name: "7 days" }).click();
    await expect(page).toHaveURL(/\/analytics\?days=7$/);
    await expect(tile("Visitors")).toContainText("2");

    // Enter post results.
    await page.getByRole("link", { name: "Post results" }).first().click();
    await expect(page.getByText("Seeded rye is back")).toBeVisible();
    await page.getByLabel("Reach").fill("200");
    await page.getByLabel("Likes").fill("15");
    await page.getByLabel("Comments").fill("5");
    await page.getByRole("button", { name: "Save results" }).click();
    await expect(page.getByText(/^Saved /)).toBeVisible();
    await page.goto("/analytics?days=7");
    await expect(tile("Engagement rate")).toContainText("10%");

    // AI insights (mock provider in e2e — labelled as such).
    await page.getByRole("button", { name: "Get insights" }).click();
    await expect(page.getByText(/^\[Mock\]/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Mock AI output (test mode)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recommendations", exact: true })).toBeVisible();

    // Exports.
    const csv = await page.request.get(`/api/v1/workspaces/${ws}/analytics/export?days=7&format=csv`);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain('"Website","Visitors","website.visitors","2"');
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Markdown" }).first().click()]);
    expect(download.suggestedFilename()).toMatch(/^brand-ai-report-7d-\d{4}-\d{2}-\d{2}\.md$/);

    // Saved report → print view.
    await page.goto("/analytics/reports");
    await expect(page.getByText("Last 7 days · All businesses")).toBeVisible();
    await page.getByRole("link", { name: "Print" }).first().click();
    await expect(page).toHaveURL(/\/print\/analytics\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Insights & recommendations" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Website" })).toContainText("Page views");

    // Tracking switch: no more counting once off.
    await page.goto("/analytics/settings");
    await page.getByLabel(/Count website visits/).uncheck();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await (await visit(CHROME, livePath)).ctx.close();
    await page.goto("/analytics?days=7");
    await expect(tile("Page views")).toContainText("3");
    await expect(page.getByText("Website visit tracking is switched off")).toBeVisible();
  });

  test("tracking endpoints never leak or redirect elsewhere; other workspaces get 404", async ({ page, browser }) => {
    // Forged email tokens: the open pixel still answers with a GIF, the click goes to the app, not a chosen URL.
    const open = await page.request.get("/api/v1/email/8d3b8f0e-7a52-4c1b-9d2e-3f4a5b6c7d8e.forged/open");
    expect(open.headers()["content-type"]).toBe("image/gif");
    const click = await page.request.get("/api/v1/email/8d3b8f0e-7a52-4c1b-9d2e-3f4a5b6c7d8e.forged/click?url=https://evil.example", { maxRedirects: 0 });
    expect(click.status()).toBe(302);
    expect(click.headers().location).toMatch(/^http:\/\/localhost:\d+\/?$/); // APP_URL
    expect(click.headers().location).not.toContain("evil");
    // Unknown site pixel: still a GIF, nothing recorded.
    expect((await page.request.get("/api/v1/sites/no-such-site/px?p=home")).headers()["content-type"]).toBe("image/gif");

    await registerViaUi(page, newUser());
    const ws = await workspaceId(page);
    const biz = (await (await page.request.post(`/api/v1/workspaces/${ws}/businesses`, { data: { name: "Private", stage: "STARTING" } })).json()).data;
    const report = (await (await page.request.post(`/api/v1/workspaces/${ws}/analytics/insights`, { data: { days: 30 } })).json()).data;
    expect(report.id).toBeTruthy();

    const other = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.99.1.2" } });
    const b = await other.newPage();
    await registerViaUi(b, newUser());
    const wsB = await workspaceId(b);
    expect((await b.request.get(`/api/v1/workspaces/${ws}/analytics`)).status()).toBe(404);
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/analytics?businessId=${biz.id}`)).status()).toBe(404);
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/analytics/reports/${report.id}`)).status()).toBe(404);
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/analytics/reports/${report.id}/export`)).status()).toBe(404);
    await b.goto(`/print/analytics/${report.id}`);
    await expect(b.getByRole("heading", { name: "This page does not exist" })).toBeVisible();
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/analytics?days=14`)).status()).toBe(422);
    await other.close();
  });
});
