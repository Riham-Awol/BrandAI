import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";

/**
 * Each test gets its own synthetic client IP so per-IP rate limits (which are
 * real and enforced) do not make tests depend on each other.
 */
export const test = base.extend({
  // Playwright's fixture callback is conventionally named `use`; it is not a React hook.
  clientIp: async ({}, provide) => {
    await provide(`10.${rand()}.${rand()}.${rand()}`);
  },
  extraHTTPHeaders: async ({ clientIp }, provide) => {
    await provide({ "x-forwarded-for": clientIp });
  },
});

function rand() {
  return Math.floor(Math.random() * 250) + 1;
}

export function newUser() {
  const id = randomUUID().slice(0, 8);
  return { name: `E2E Tester ${id}`, email: `e2e-${id}@example.com`, password: `e2e-pass-${id}-9` };
}

export async function registerViaUi(page, user) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(user.name);
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginViaUi(page, user) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export { expect };
