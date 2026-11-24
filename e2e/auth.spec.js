import { expect, loginViaUi, newUser, registerViaUi, test } from "./fixtures.js";

test.describe("authentication", () => {
  test("landing page links to registration", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Your AI Marketing Team");
    await page.getByRole("link", { name: /Create your workspace/ }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("register → dashboard → sign out → protected → sign in", async ({ page }) => {
    const user = newUser();
    await registerViaUi(page, user);
    await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible();
    await expect(page.getByText("Your first business starts here")).toBeVisible();
    await expect(page.getByText("AI text generations")).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard/);

    await loginViaUi(page, user);
    await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible();
  });

  test("shows field validation and a generic error for wrong credentials", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  });

  test("duplicate registration is rejected", async ({ page }) => {
    const user = newUser();
    await registerViaUi(page, user);
    await page.context().clearCookies();
    await page.goto("/register");
    await page.getByLabel("Full name").fill(user.name);
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("An account with this email already exists.")).toBeVisible();
  });

  test("forgot password never reveals whether an account exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("ghost@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists for that email/)).toBeVisible();
  });

  test("reset page without a token explains the problem", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText("This reset link is incomplete.")).toBeVisible();
  });
});
