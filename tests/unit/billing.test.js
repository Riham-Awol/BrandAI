import { describe, expect, it } from "vitest";
import { PLANS, limitFor, planInEffect, withinLimit } from "@/server/billing/plans.js";
import { encodeForm, signStripePayload, verifyStripeSignature } from "@/server/billing/stripe.js";
import { signSvixPayload, verifySvixSignature } from "@/server/email/webhook.js";
import { checkoutSchema, clientSchema, createWorkspaceSchema, inviteSchema, roleSchema } from "@/validation/team.js";
import { grantCreditsSchema } from "@/validation/admin.js";
import { PERMISSIONS, roleHasPermission } from "@/server/permissions/roles.js";

describe("plans", () => {
  it("only active, trialing or past-due subscriptions keep paid benefits", () => {
    expect(planInEffect(null)).toBe("FREE");
    expect(planInEffect({ plan: "PRO", status: "ACTIVE" })).toBe("PRO");
    expect(planInEffect({ plan: "PRO", status: "PAST_DUE" })).toBe("PRO");
    expect(planInEffect({ plan: "AGENCY", status: "CANCELED" })).toBe("FREE");
    expect(planInEffect({ plan: "PRO", status: "INCOMPLETE" })).toBe("FREE");
  });
  it("limits grow with the plan and are checked inclusively", () => {
    for (const k of ["members", "businesses", "websites", "aiCredits", "storageBytes"]) {
      expect(PLANS.FREE.limits[k]).toBeLessThanOrEqual(PLANS.PRO.limits[k]);
      expect(PLANS.PRO.limits[k]).toBeLessThanOrEqual(PLANS.AGENCY.limits[k]);
    }
    expect(limitFor("FREE", "clients")).toBe(0);
    expect(withinLimit("FREE", "members", 1)).toBe(true);
    expect(withinLimit("FREE", "members", 2)).toBe(false);
    expect(withinLimit("AGENCY", "members", 10, 5)).toBe(true);
    expect(withinLimit("AGENCY", "members", 10, 6)).toBe(false);
  });
});

describe("Stripe helpers", () => {
  it("encodes nested params the way Stripe expects", () => {
    expect(encodeForm({ mode: "subscription", line_items: [{ price: "p", quantity: 1 }], metadata: { workspaceId: "w" }, skip: undefined }).toString())
      .toBe("mode=subscription&line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1&metadata%5BworkspaceId%5D=w");
  });
  it("verifies webhook signatures with a replay window", () => {
    const raw = JSON.stringify({ id: "evt_1", type: "x" });
    const now = 1_800_000_000_000;
    const header = signStripePayload(raw, "whsec_a", now / 1000);
    expect(verifyStripeSignature(raw, header, "whsec_a", { now }).id).toBe("evt_1");
    expect(() => verifyStripeSignature(raw, header, "whsec_b", { now })).toThrow(/Invalid signature/);
    expect(() => verifyStripeSignature(`${raw} `, header, "whsec_a", { now })).toThrow(/Invalid signature/);
    expect(() => verifyStripeSignature(raw, header, "whsec_a", { now: now + 301_000 })).toThrow(/Invalid signature/);
    expect(() => verifyStripeSignature(raw, "", "whsec_a", { now })).toThrow(/Invalid signature/);
  });
  it("verifies Resend (Svix) signatures", () => {
    const secret = `whsec_${Buffer.from("k").toString("base64")}`;
    const raw = JSON.stringify({ type: "email.bounced" });
    const now = 1_800_000_000_000;
    const h = signSvixPayload(raw, secret, { ts: now / 1000 });
    expect(verifySvixSignature(raw, h, secret, { now }).type).toBe("email.bounced");
    expect(() => verifySvixSignature(raw, h, `whsec_${Buffer.from("j").toString("base64")}`, { now })).toThrow(/Invalid signature/);
    expect(() => verifySvixSignature(raw, h, secret, { now: now + 400_000 })).toThrow(/Invalid signature/);
  });
});

describe("team and admin validation, permissions", () => {
  it("validates inputs", () => {
    expect(inviteSchema.safeParse({ email: "A@B.co", role: "OWNER" }).success).toBe(false);
    expect(inviteSchema.parse({ email: " A@B.co ", role: "EDITOR" }).email).toBe("a@b.co");
    expect(roleSchema.safeParse({ role: "OWNER" }).success).toBe(false);
    expect(createWorkspaceSchema.parse({ name: "Team" }).type).toBe("TEAM");
    expect(createWorkspaceSchema.safeParse({ name: "Me", type: "PERSONAL" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ plan: "FREE" }).success).toBe(false);
    expect(clientSchema.safeParse({ name: "X Co", contactEmail: "nope" }).success).toBe(false);
    expect(clientSchema.parse({ name: "X Co", contactEmail: "" }).contactEmail).toBeUndefined();
    expect(grantCreditsSchema.safeParse({ amount: 0, note: "why" }).success).toBe(false);
    expect(grantCreditsSchema.safeParse({ amount: 10, note: "" }).success).toBe(false);
  });
  it("owner-only and admin permissions", () => {
    for (const p of [PERMISSIONS.MEMBERS_MANAGE_ADMINS, PERMISSIONS.OWNERSHIP_TRANSFER, PERMISSIONS.BILLING_MANAGE]) {
      expect(roleHasPermission("OWNER", p)).toBe(true);
      expect(roleHasPermission("ADMIN", p)).toBe(false);
    }
    expect(roleHasPermission("ADMIN", PERMISSIONS.CLIENTS_MANAGE)).toBe(true);
    expect(roleHasPermission("EDITOR", PERMISSIONS.CLIENTS_MANAGE)).toBe(false);
  });
});
