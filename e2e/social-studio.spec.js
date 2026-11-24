import { readFile } from "node:fs/promises";
import { expect, newUser, registerViaUi, test } from "./fixtures.js";

test.describe("Social Media Studio", () => {
  test.setTimeout(120_000);

  test("plan → strategy → calendar → posts from calendar → batch write → edit/preview/ready → quick post → exports", async ({ page }) => {
    await registerViaUi(page, newUser());
    const nav = (name) => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: new RegExp(name) });

    await page.goto("/social/new");
    await page.getByLabel("Business name").fill("Crust & Culture");
    await page.getByLabel("Month", { exact: true }).fill("2027-02");
    await expect(page.getByRole("button", { name: "Instagram" })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Focus this month (optional)").fill("Valentine's sourdough hearts");
    await page.getByRole("button", { name: "Start social plan" }).click();
    await expect(page).toHaveURL(/\/social\/[0-9a-f-]{36}$/);
    await expect(page.getByText("February 2027 · Instagram, Facebook · 4 posts/week")).toBeVisible();

    await nav("Social strategy").click();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.getByText("#LeedsFood")).toBeVisible();

    await nav("Content calendar").click();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.getByText("Meet our café partners").first()).toBeVisible();
    await expect(page.getByText("Unselected platform")).toHaveCount(0);

    // Posts board.
    await nav("Posts").click();
    await page.getByRole("button", { name: "Add calendar ideas" }).first().click();
    await expect(page.getByText("4 post ideas added from the calendar.")).toBeVisible();
    await page.getByRole("button", { name: "Write next 4 ideas" }).click();
    await expect(page.getByText("4 posts written.")).toBeVisible();
    await expect(page.getByText("Draft", { exact: true })).toHaveCount(4);

    // Open the carousel post: preview, checks, edit, mark ready.
    await page.getByRole("button", { name: /Meet our café partners/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Instagram · Carousel · 2027-02-05")).toBeVisible();
    await expect(dialog.getByText("1. Slide 1")).toBeVisible();
    await expect(dialog.getByText(/Fits Instagram's limits/)).toBeVisible();
    await dialog.getByLabel("Call to action").fill("Order for your café today.");
    await dialog.getByLabel("Status").selectOption("READY");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Saved.")).toBeVisible();
    await dialog.getByRole("button", { name: /History/ }).click();
    await expect(dialog.getByText(/v2 · edited/)).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("Ready", { exact: true })).toHaveCount(1);

    // Quick tool: single post written immediately.
    await page.getByRole("button", { name: "Add a post" }).click();
    await page.getByLabel("What is the post about?").fill("New rye loaf launch");
    await page.getByLabel("Date").fill("2027-02-20");
    await page.getByLabel("Format").selectOption("SHORT_VIDEO");
    await page.getByRole("button", { name: "Write with AI" }).click();
    const editor = page.getByRole("dialog");
    await expect(editor.getByText("Instagram · Reel / short video · 2027-02-20")).toBeVisible();
    await expect(editor.getByText("15s")).toBeVisible();
    await editor.getByRole("button", { name: "Close" }).click();

    // Exports.
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSV" }).click();
    const csv = await readFile(await (await csvDownload).path(), "utf8");
    expect(csv.split("\r\n")[0]).toContain("Date,Day,Platform,Format,Status,Title");
    expect(csv).toContain("New rye loaf launch");
    const mdDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Markdown" }).click();
    expect(await readFile(await (await mdDownload).path(), "utf8")).toContain("# Crust & Culture — social posts for 2027-02");
  });

  test("other workspaces cannot reach the social plan or its posts", async ({ browser }) => {
    const ctxA = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.204.0.1" } });
    const a = await ctxA.newPage();
    await registerViaUi(a, newUser());
    await a.goto("/social/new");
    await a.getByLabel("Business name").fill("Private Social");
    await a.getByRole("button", { name: "Start social plan" }).click();
    await expect(a).toHaveURL(/\/social\/[0-9a-f-]{36}$/);
    const projectId = a.url().split("/").pop();

    const ctxB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.204.0.2" } });
    const b = await ctxB.newPage();
    await registerViaUi(b, newUser());
    const wsB = (await (await b.request.get("/api/v1/me")).json()).data.workspaces[0].id;
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/social-projects/${projectId}/posts`)).status()).toBe(404);
    expect((await b.request.get(`/api/v1/workspaces/${wsB}/social-projects/${projectId}/export?format=csv`)).status()).toBe(404);
    await b.goto(`/social/${projectId}`);
    await expect(b.getByText("This page does not exist")).toBeVisible();
    await ctxA.close();
    await ctxB.close();
  });
});
