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

test("mobile layout: brand studio palettes and logo variants fit the screen", async ({ page }) => {
  await registerViaUi(page, newUser());
  await page.goto("/brand/new");
  await page.getByLabel("Business name").fill("Mobile Brand");
  await page.getByRole("button", { name: "Start brand identity" }).click();
  await expect(page).toHaveURL(/\/brand\/[0-9a-f-]{36}$/);
  const nav = (name) => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: new RegExp(name) });
  for (const t of ["Personality", "Colours", "Type", "Logo"]) {
    await nav(t).click();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Variations of the selected logo" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("mobile layout: strategy budget chart and table fit the screen", async ({ page }) => {
  await registerViaUi(page, newUser());
  await page.goto("/strategy/new");
  await page.getByLabel("Business name").fill("Mobile Strategy");
  await page.getByLabel("Monthly budget").fill("500");
  await page.getByRole("button", { name: "Start marketing strategy" }).click();
  await expect(page).toHaveURL(/\/strategy\/[0-9a-f-]{36}$/);
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: /Budget/ }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByText("Monthly budget by channel (GBP)")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("mobile layout: social calendar list and post editor fit the screen", async ({ page }) => {
  await registerViaUi(page, newUser());
  await page.goto("/social/new");
  await page.getByLabel("Business name").fill("Mobile Social");
  await page.getByLabel("Month", { exact: true }).fill("2027-02");
  await page.getByRole("button", { name: "Start social plan" }).click();
  await expect(page).toHaveURL(/\/social\/[0-9a-f-]{36}$/);
  const nav = (name) => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: new RegExp(name) });
  await nav("Calendar").click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByText("Weekend loaf deal").filter({ visible: true })).toBeVisible();
  await nav("Posts").click();
  await page.getByRole("button", { name: "Add calendar ideas" }).first().click();
  await page.getByRole("button", { name: /Dough at dawn/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("mobile layout: design options and editor fit the screen", async ({ page }) => {
  await registerViaUi(page, newUser());
  await page.goto("/design/new");
  await page.getByLabel("Business name").fill("Mobile Designs");
  await page.getByLabel("Brief").fill("Flyer for our weekend market stall");
  await page.getByRole("button", { name: "Generate 3 designs" }).click();
  await expect(page.getByRole("img", { name: /Design option 1/ })).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Use this design" }).first().click();
  await expect(page.getByRole("img", { name: /^Preview:/ })).toHaveAttribute("src", /^data:image\/svg\+xml/);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("mobile layout: website editor and published site fit the screen", async ({ page }) => {
  await registerViaUi(page, newUser());
  await page.goto("/websites/new");
  await page.getByLabel("Business name").fill("Mobile Site");
  await page.getByRole("button", { name: "Start from template" }).click();
  await expect(page.getByTestId("site-preview")).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published. Your website is live.")).toBeVisible();
  await page.goto(await page.getByRole("link", { name: "View live site" }).getAttribute("href"));
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Mobile Site" })).toBeVisible();
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("mobile layout: invoice editor and branded item editor fit the screen", async ({ page }) => {
  await registerViaUi(page, newUser());
  await page.goto("/stationery/documents/new?type=INVOICE");
  await page.getByLabel("Business name").fill("Mobile Co");
  await page.getByLabel("Item 1 description").fill("Work");
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.goto("/stationery/materials/new?kind=MUG");
  await page.getByLabel("Business name").fill("Mobile Co");
  await page.getByRole("button", { name: "Suggest 3 designs" }).click();
  await page.getByRole("button", { name: "Use this design" }).first().click();
  await expect(page.getByRole("img", { name: /^Preview:/ })).toBeVisible();
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("mobile layout: automation calendar agenda and settings fit the screen", async ({ page }) => {
  await registerViaUi(page, newUser());
  await page.goto("/automation");
  await expect(page.getByRole("heading", { name: "Calendar & Automation" })).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.goto("/automation/settings");
  await expect(page.getByRole("radio", { name: /Draft only/ })).toBeVisible();
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
