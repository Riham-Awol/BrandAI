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
