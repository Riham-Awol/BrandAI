import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLES, permissionsForRole, roleHasPermission } from "@/server/permissions/roles.js";

describe("role permissions", () => {
  it("grants every permission to OWNER", () => {
    for (const p of Object.values(PERMISSIONS)) expect(roleHasPermission("OWNER", p)).toBe(true);
  });

  it("keeps roles strictly nested (VIEWER ⊂ EDITOR ⊂ ADMIN ⊂ OWNER)", () => {
    for (let i = 1; i < ROLES.length; i++) {
      const higher = new Set(permissionsForRole(ROLES[i - 1]));
      for (const p of permissionsForRole(ROLES[i])) expect(higher.has(p)).toBe(true);
    }
  });

  it("does not let viewers write or generate", () => {
    expect(roleHasPermission("VIEWER", PERMISSIONS.BUSINESS_READ)).toBe(true);
    expect(roleHasPermission("VIEWER", PERMISSIONS.BUSINESS_CREATE)).toBe(false);
    expect(roleHasPermission("VIEWER", PERMISSIONS.AI_GENERATE)).toBe(false);
  });

  it("reserves context approval and billing for admins/owners", () => {
    expect(roleHasPermission("EDITOR", PERMISSIONS.CONTEXT_APPROVE)).toBe(false);
    expect(roleHasPermission("ADMIN", PERMISSIONS.CONTEXT_APPROVE)).toBe(true);
    expect(roleHasPermission("ADMIN", PERMISSIONS.BILLING_MANAGE)).toBe(false);
  });

  it("rejects unknown roles", () => {
    expect(roleHasPermission("SUPERUSER", PERMISSIONS.BUSINESS_READ)).toBe(false);
    expect(permissionsForRole(undefined)).toEqual([]);
  });
});
