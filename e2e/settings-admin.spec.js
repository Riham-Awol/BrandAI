import { execFileSync } from "node:child_process";
import { currentStep, totpAt } from "../src/server/auth/totp.js";
import { expect, newUser, registerViaUi, test } from "./fixtures.js";

async function enableMfa(page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Set up two-factor sign-in" }).click();
  const secret = (await page.getByTestId("mfa-secret").textContent()).trim();
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  await page.getByLabel("2. Enter the 6-digit code it shows").fill(totpAt(secret, currentStep()));
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem")).toHaveCount(10);
  return secret;
}

async function signOut(page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("Account, team, plans and administration", () => {
  test.setTimeout(150_000);

  test("profile, two-factor sign-in and signing out everywhere", async ({ page }) => {
    const user = newUser();
    await registerViaUi(page, user);
    await page.goto("/settings");
    await expect(page.getByText("Not verified")).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill("Ada Lovelace");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const secret = await enableMfa(page);
    await expect(page.getByText("Two-factor sign-in is on.")).toBeVisible();
    await signOut(page);

    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByLabel("Authentication code").fill("000000");
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page.getByText(/That code didn't work/)).toBeVisible();
    await page.getByLabel("Authentication code").fill(totpAt(secret, currentStep() + 1));
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out everywhere" }).click();
    await expect(page).toHaveURL(/\/login\?signedout=1/);
    await expect(page.getByText("You were signed out on every device.")).toBeVisible();
    // The old session cookie no longer works.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("team workspace, invitations, plan page and audit log", async ({ page }) => {
    await registerViaUi(page, newUser());
    await page.goto("/settings/members");
    await expect(page.getByText("This is your personal workspace.")).toBeVisible();

    await page.goto("/settings/workspace");
    await page.getByLabel("Workspace name").fill("Kirkgate Team");
    await page.getByRole("button", { name: "Create and switch" }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Kirkgate Team");

    await page.goto("/settings/members");
    await expect(page.getByText("1 of 2 seats used (Free plan)")).toBeVisible();
    await page.getByLabel("Email").fill("teammate@example.com");
    await page.getByLabel("Role").selectOption("VIEWER");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Invitation sent.")).toBeVisible();
    await expect(page.getByText(/teammate@example.com · Viewer/)).toBeVisible();
    // Free plan: both seats taken (you + the pending invitation).
    await page.getByLabel("Email").fill("third@example.com");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText(/includes up to 2 team members/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel invitation for teammate@example.com" }).click();
    await expect(page.getByText("Invitation cancelled.")).toBeVisible();

    await page.goto("/settings/billing");
    await expect(page.getByRole("heading", { name: "Free plan" })).toBeVisible();
    await expect(page.getByRole("meter", { name: /Monthly allowance/ })).toBeVisible();
    await expect(page.getByText(/Online payments aren't configured on this server yet/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Upgrade to Pro" })).toBeDisabled();

    await page.goto("/settings/audit");
    await expect(page.getByRole("cell", { name: "member.invited" }).first()).toBeVisible();

    // Unknown invitation links are refused politely.
    await page.goto("/invite/not-a-real-token-not-a-real-token-xx");
    await expect(page.getByText("This invitation link isn't valid.")).toBeVisible();
  });

  test("platform admin assigns the Agency plan; the agency adds a client workspace", async ({ page, browser }) => {
    const user = newUser();
    await registerViaUi(page, user);
    // Non-admins don't even see that the admin area exists.
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "This page does not exist" })).toBeVisible();

    execFileSync("node", ["scripts/grant-platform-admin.mjs", user.email], { stdio: "pipe" });
    await page.goto("/admin");
    await expect(page.getByText("Two-factor sign-in required")).toBeVisible();
    await enableMfa(page);
    await page.goto("/admin");
    await expect(page.getByText("Monthly recurring revenue")).toBeVisible();

    await page.goto("/settings/workspace");
    await page.getByRole("radio", { name: "Agency" }).click();
    const agencyName = `Studio North ${Date.now()}`;
    await page.getByLabel("Workspace name").fill(agencyName);
    await page.getByRole("button", { name: "Create and switch" }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(agencyName);

    await page.goto("/settings/clients");
    await page.getByLabel("Client name").fill("Kirkgate Bakery");
    await page.getByRole("button", { name: "Add client" }).click();
    await expect(page.getByText(/doesn't include clients/)).toBeVisible();

    await page.goto("/admin/workspaces");
    await page.getByLabel("Search workspaces").fill(agencyName);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("button", { name: "Manage" })).toHaveCount(1);
    await page.getByRole("button", { name: "Manage" }).click();
    await page.getByLabel("Plan", { exact: true }).selectOption("AGENCY");
    await page.getByRole("button", { name: "Set plan" }).click();
    await expect(page.getByText("Plan updated.")).toBeVisible();

    await page.goto("/settings/clients");
    await page.getByLabel("Client name").fill("Kirkgate Bakery");
    await page.getByLabel("Contact email (optional)").fill("owner@bakery.example");
    await page.getByRole("button", { name: "Add client" }).click();
    await expect(page.getByText("Client added with its own workspace.")).toBeVisible();
    await page.getByRole("button", { name: "Open workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/settings/billing");
    await expect(page.getByText(/uses .* plan and AI credits/)).toBeVisible();

    // AI kill switch.
    await page.goto("/admin/ai");
    await page.getByRole("button", { name: "Pause all AI" }).click();
    await expect(page.getByText("Paused", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Resume AI" }).click();
    await expect(page.getByText("Running", { exact: true })).toBeVisible();
    await page.goto("/admin/audit");
    await expect(page.getByRole("cell", { name: "platform.plan_set" })).toBeVisible();

    // Another person can't use the admin API.
    const other = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.98.7.6" } });
    const o = await other.newPage();
    await registerViaUi(o, newUser());
    expect((await o.request.get("/api/v1/admin/overview")).status()).toBe(404);
    await other.close();
  });
});
