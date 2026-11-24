import { expect, newUser, registerViaUi, test } from "./fixtures.js";

async function workspaceId(page) {
  return (await (await page.request.get("/api/v1/me")).json()).data.workspaces[0].id;
}

test.describe("Calendar & Automation", () => {
  test.setTimeout(150_000);

  test("approval policy → draft-only → run now → post manually → history, notifications", async ({ page }) => {
    await registerViaUi(page, newUser());
    const ws = await workspaceId(page);
    await page.request.post(`/api/v1/workspaces/${ws}/businesses`, { data: { name: "Kirkgate Bakery", stage: "STARTING" } });

    // Approval required with a separate approver: the owner can't approve their own post.
    await page.goto("/automation/settings");
    await page.getByRole("radio", { name: /Approval required/ }).click();
    await page.getByLabel("Approver must be a different person").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Automation settings saved.")).toBeVisible();
    await expect(page.getByText("Mode:").locator("..")).toContainText("Approval required");

    // Connect a webhook: the signing secret is shown once; unsafe URLs are refused.
    await page.getByLabel("Name", { exact: true }).fill("Local");
    await page.getByLabel("HTTPS URL").fill("https://127.0.0.1/hook");
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByText(/Use a public https:\/\/ URL/)).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill("Zapier");
    await page.getByLabel("HTTPS URL").fill("https://hooks.zapier.com/hooks/catch/1/abc");
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByText("Webhook signing secret — copy it now")).toBeVisible();

    await page.goto("/automation/queue");
    await page.getByRole("button", { name: "Schedule something" }).click();
    await page.getByLabel("Post text").fill("Fresh seeded rye this Saturday!");
    await page.getByLabel("Channel").selectOption({ label: "Zapier" });
    await expect(page.getByText(/goes out automatically once an owner or admin approves it/)).toBeVisible();
    await page.getByRole("button", { name: "Schedule & request approval" }).click();
    await expect(page.getByText("Waiting for approval")).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Someone other than the person who scheduled it must approve it.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("tab", { name: /Rejected & cancelled/ }).click();
    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();

    // Draft-only: a due post becomes "post manually" — nothing is sent.
    await page.goto("/automation/settings");
    await page.getByRole("radio", { name: /Draft only/ }).click();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Automation settings saved.")).toBeVisible();
    await page.goto("/automation/queue");
    await page.getByRole("button", { name: "Schedule something" }).click();
    await page.getByLabel("Post text").fill("Market day reminder");
    await page.getByLabel("Channel").selectOption({ label: "Zapier" });
    const past = new Date(Date.now() - 5 * 60000);
    await page.getByLabel("Date and time").fill(new Date(past.getTime() - past.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    await expect(page.getByText(/Draft-only mode: you'll get a reminder/)).toBeVisible();
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Market day reminder").first()).toBeVisible();
    await page.goto("/automation/settings");
    await page.getByRole("button", { name: "Run now" }).click();
    await expect(page.getByText(/Run complete: 0 published, 1 to post manually/)).toBeVisible();

    await page.goto("/automation/queue");
    await expect(page.getByText("Post manually")).toBeVisible();
    await page.getByLabel("Post URL for Market day reminder").fill("https://instagram.com/p/abc");
    await page.getByRole("button", { name: "Mark as posted" }).click();
    await page.getByRole("tab", { name: /Published/ }).click();
    await expect(page.getByRole("link", { name: "View post" })).toHaveAttribute("href", "https://instagram.com/p/abc");

    await page.goto("/automation/history");
    await expect(page.getByText(/is due — Draft-only mode/)).toBeVisible();
    await expect(page.getByText("Automation mode changed from APPROVAL_REQUIRED to DRAFT_ONLY.")).toBeVisible();
    await page.getByRole("button", { name: /Notifications, \d+ unread/ }).click();
    await expect(page.getByText("Time to post: Market day reminder")).toBeVisible();
  });

  test("audience with consent, AI campaign, test send, calendar and reminders", async ({ page }) => {
    await registerViaUi(page, newUser());
    const ws = await workspaceId(page);
    await page.request.post(`/api/v1/workspaces/${ws}/businesses`, { data: { name: "Kirkgate Bakery", stage: "STARTING" } });

    await page.goto("/automation/audience");
    await page.getByLabel("Email", { exact: true }).fill("ann@example.com");
    await page.getByLabel("How did they agree?").first().fill("Signed up at the stall");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText("Confirm you have this person's consent.")).toBeVisible();
    await page.getByLabel("This person agreed to receive marketing emails from this business.").check();
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText("Contact added.")).toBeVisible();
    await expect(page.getByText("1 subscribed of 1 contacts").or(page.getByText(/^1\s*subscribed of 1 contacts$/))).toBeVisible();

    await page.goto("/automation/campaigns");
    await page.getByLabel("Campaign name").fill("Rye is back");
    await page.getByLabel("What is the email about?").fill("Seeded rye returns Saturday");
    await page.getByRole("button", { name: "Write with AI" }).click();
    await expect(page).toHaveURL(/\/automation\/campaigns\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel("Subject line")).toHaveValue("[Mock] Fresh rye is back this Saturday");
    await expect(page.frameLocator('iframe[title="Email preview"]').getByText("Our seeded rye is back")).toBeVisible();
    await expect(page.frameLocator('iframe[title="Email preview"]').getByRole("link", { name: "Unsubscribe" })).toBeVisible();
    await page.getByRole("button", { name: "Send me a test" }).click();
    await expect(page.getByText(/Test sent to .* \(logged by the development provider\)/)).toBeVisible();
    await page.getByRole("button", { name: "Schedule send" }).click();
    await expect(page).toHaveURL(/\/automation\/queue$/);
    await page.getByRole("tab", { name: /Scheduled/ }).click();
    await expect(page.getByText("Email: Rye is back")).toBeVisible();

    await page.goto("/automation/rules");
    await page.getByLabel("Reminder").fill("Order flour");
    const soon = new Date(Date.now() + 2 * 3600000);
    await page.getByLabel("When").fill(new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    await page.getByRole("button", { name: "Add reminder" }).click();
    await expect(page.getByText("Order flour")).toBeVisible();
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.getByRole("button", { name: "Turn off" })).toBeVisible();

    await page.goto("/automation");
    await expect(page.getByRole("link", { name: /Email: Rye is back/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Order flour/ }).first()).toBeVisible();
  });

  test("scheduler endpoint needs the secret; other workspaces can't see items", async ({ page, browser }) => {
    expect((await page.request.post("/api/v1/cron/run")).status()).toBeGreaterThanOrEqual(401);
    expect((await page.request.post("/api/v1/cron/run", { headers: { authorization: "Bearer wrong" } })).status()).toBeGreaterThanOrEqual(401);

    await registerViaUi(page, newUser());
    const ws = await workspaceId(page);
    const biz = (await (await page.request.post(`/api/v1/workspaces/${ws}/businesses`, { data: { name: "Private", stage: "STARTING" } })).json()).data;
    const item = (await (await page.request.post(`/api/v1/workspaces/${ws}/automation/items`, { data: { businessId: biz.id, sourceType: "CUSTOM", text: "Secret plan", scheduledAt: new Date(Date.now() + 3600000).toISOString() } })).json()).data;

    const ctxB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.209.0.2" } });
    const b = await ctxB.newPage();
    await registerViaUi(b, newUser());
    const wsB = await workspaceId(b);
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/automation/items/${item.id}`)).status()).toBe(404);
    expect((await b.request.post(`/api/v1/workspaces/${wsB}/automation/items/${item.id}/publish-now`)).status()).toBe(404);
    expect((await b.request.get(`/api/v1/workspaces/${ws}/automation/items`)).status()).toBe(404);
    await ctxB.close();
  });
});
