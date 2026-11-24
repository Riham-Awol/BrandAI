import { expect, newUser, registerViaUi, test } from "./fixtures.js";

test("mobile layout: navigation drawer and no horizontal scroll", async ({ page }) => {
  await registerViaUi(page, newUser());
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("link", { name: "Overview" })).toBeVisible();
  await drawer.getByRole("button", { name: "Close navigation" }).click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("mobile layout: launch studio steps scroll horizontally without page overflow", async ({ page }) => {
  await registerViaUi(page, newUser());
  await page.goto("/launch/new");
  await page.getByLabel("Describe your business idea").fill("A mobile coffee cart serving office parks in Lagos every weekday.");
  await page.getByLabel("Country").fill("Nigeria");
  await page.getByRole("button", { name: "Start launch plan" }).click();
  await expect(page).toHaveURL(/\/launch\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByRole("img", { name: /Viability score/ })).toBeVisible();
  await page.getByRole("button", { name: "Names" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Business names" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
