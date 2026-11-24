import { expect, newUser, registerViaUi, test } from "./fixtures.js";

test.describe("Website Builder", () => {
  test.setTimeout(120_000);

  test("AI store site → edit with live preview → publish → public site → order enquiry → messages", async ({ page, browser }) => {
    await registerViaUi(page, newUser());
    await page.goto("/websites");
    await expect(page.getByText("No websites yet")).toBeVisible();
    await page.getByRole("link", { name: "New website" }).click();
    await page.getByLabel("Business name").fill("Kirkgate Bakery");
    await page.getByRole("button", { name: /Online store/ }).click();
    await page.getByRole("button", { name: "Bold" }).click();
    await page.getByRole("button", { name: "Write my website" }).click();

    await expect(page).toHaveURL(/\/websites\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Online store · Kirkgate Bakery")).toBeVisible();
    const preview = page.getByTestId("site-preview");
    await expect(preview.getByRole("heading", { name: "[Mock] Real bread, baked before sunrise" })).toBeVisible();

    // Edit the hero: the preview updates immediately.
    await page.getByLabel("Heading", { exact: true }).fill("Bread worth getting up for");
    await expect(preview.getByRole("heading", { name: "Bread worth getting up for" })).toBeVisible();
    // Unsafe links are rejected with a field error.
    await page.getByLabel("Cta link").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Some fields need attention")).toBeVisible();
    await page.getByLabel("Cta link").fill("/contact");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();

    // Add a section, navigate the preview to another page.
    await page.getByLabel("Add a section").selectOption("text");
    await expect(page.getByRole("button", { name: /^Text · Text/ })).toBeVisible();
    await preview.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shop" }).click();
    await expect(page.getByLabel("Page", { exact: true })).toHaveValue("shop");

    // Rewrite a section with AI.
    await page.getByRole("button", { name: /^Products/ }).click();
    await page.getByRole("button", { name: "Rewrite section" }).click();
    await expect(page.getByText("Section rewritten and saved to the draft.")).toBeVisible();
    await expect(preview.getByRole("heading", { name: "[Mock] Rewritten products" })).toBeVisible();

    // Publish.
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published. Your website is live.")).toBeVisible();
    await expect(page.getByText("Published · v1")).toBeVisible();
    const livePath = await page.getByRole("link", { name: "View live site" }).getAttribute("href");
    expect(livePath).toMatch(/^\/sites\/kirkgate-bakery(-\d+)?$/);

    // Public site works without logging in.
    const visitor = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.206.0.9" } });
    const v = await visitor.newPage();
    await v.goto(livePath);
    await expect(v).toHaveTitle(/Home \| Kirkgate Bakery/);
    await expect(v.getByRole("heading", { level: 1, name: "Bread worth getting up for" })).toBeVisible();
    await v.getByRole("link", { name: "Order / enquire" }).first().click();
    await expect(v).toHaveURL(new RegExp(`${livePath}/contact\\?item=Country%20loaf`));
    await v.getByLabel("Name").fill("Ann Visitor");
    await v.getByLabel("Email").fill("ann@example.com");
    await v.getByRole("button", { name: "Send order enquiry" }).click();
    await expect(v.getByText("Thank you — your message was sent.")).toBeVisible();
    // Cache Components streams a 200 shell; unknown pages show the not-found UI with noindex.
    await v.goto(`${livePath}/nope`);
    await expect(v.getByText("This page does not exist")).toBeVisible();
    expect(await v.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0);
    await visitor.close();

    // The owner sees the message.
    await page.reload();
    await page.getByRole("tab", { name: /Messages/ }).click();
    await expect(page.getByText("Ann Visitor")).toBeVisible();
    await expect(page.getByText("Item: Country loaf")).toBeVisible();

    // Domain connection shows DNS records; unverified domains don't serve the site.
    await page.getByRole("tab", { name: "Publish & domain" }).click();
    const domain = `www.kirkgate-${Date.now().toString(36)}.example`;
    await page.getByLabel("Domain").fill(domain);
    await page.getByRole("button", { name: "Connect domain" }).click();
    await expect(page.getByText("Waiting for DNS")).toBeVisible();
    await expect(page.getByText(`_brandai.${domain}`)).toBeVisible();
    expect(await (await page.request.get("/", { headers: { "x-forwarded-host": domain } })).text()).toContain("This page does not exist");

    // Take offline.
    await page.getByRole("button", { name: "Take offline" }).click();
    await expect(page.getByText("The website is offline.")).toBeVisible();
    expect(await (await page.request.get(livePath)).text()).toContain("This page does not exist");
  });

  test("other workspaces cannot open or edit a website", async ({ browser }) => {
    const ctxA = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.207.0.1" } });
    const a = await ctxA.newPage();
    await registerViaUi(a, newUser());
    await a.goto("/websites/new");
    await a.getByLabel("Business name").fill("Private Site");
    await a.getByRole("button", { name: "Start from template" }).click();
    await expect(a).toHaveURL(/\/websites\/[0-9a-f-]{36}$/);
    const websiteId = a.url().split("/").pop();
    await expect(a.getByTestId("site-preview").getByRole("heading", { name: "Welcome to Private Site" })).toBeVisible();

    const ctxB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.207.0.2" } });
    const b = await ctxB.newPage();
    await registerViaUi(b, newUser());
    const wsB = (await (await b.request.get("/api/v1/me")).json()).data.workspaces[0].id;
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/websites/${websiteId}`)).status()).toBe(404);
    expect((await b.request.post(`/api/v1/workspaces/${wsB}/websites/${websiteId}/publish`)).status()).toBe(404);
    await b.goto(`/websites/${websiteId}`);
    await expect(b.getByText("This page does not exist")).toBeVisible();
    await ctxA.close();
    await ctxB.close();
  });
});
