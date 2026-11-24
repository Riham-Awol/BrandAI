import { describe, expect, it } from "vitest";
import { buildContextFromProfile, profileFromLaunchContent } from "@/server/businesses/profile-utils.js";
import { businessProfileSchema } from "@/validation/profile.js";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/launch/mock-fixtures.js";

const content = Object.fromEntries(
  ["idea_analysis", "names", "industry", "audience", "problems", "competitors", "business_model", "strategy"].map((k) => [k, mockFixtureResponder({ module: "launch", task: k }).data]),
);
const input = { idea: "Bakery idea text", country: "UK", city: "Leeds", stage: "IDEA" };

describe("profileFromLaunchContent", () => {
  it("uses the first suggested name when the business is untitled", () => {
    const p = profileFromLaunchContent({ input, content, business: { name: "Untitled business" }, current: null });
    expect(p.name).toBe("Crumb & Co");
    expect(p.products.map((x) => x.name)).toEqual(["Sourdough loaf"]);
    expect(p.services.map((x) => x.name)).toEqual(["Café supply"]);
    expect(p.audiences[0]).toMatchObject({ name: "Young professionals", isPrimary: true, needs: "Speed" });
    expect(p.locations).toEqual([{ city: "Leeds", country: "UK", isPrimary: true, isOnline: false }]);
    expect(businessProfileSchema.safeParse(p).success).toBe(true);
  });

  it("keeps existing profile values over generated ones", () => {
    const current = { industry: "Bakery", products: [{ name: "Existing" }], services: [], locations: [], audiences: [], problems: [], competitors: [], goals: [] };
    const p = profileFromLaunchContent({ input, content, business: { name: "My Bakery" }, current });
    expect(p.name).toBe("My Bakery");
    expect(p.industry).toBe("Bakery");
    expect(p.products).toEqual([{ name: "Existing" }]);
  });

  it("works with no generated content at all", () => {
    const p = profileFromLaunchContent({ input, content: {}, business: { name: "Solo" }, current: null });
    expect(p).toMatchObject({ name: "Solo", description: "Bakery idea text", products: [], competitors: [] });
  });
});

describe("buildContextFromProfile", () => {
  it("creates only sections that have content", () => {
    expect(Object.keys(buildContextFromProfile({ name: "A", stage: "IDEA", products: [], services: [], audiences: [], problems: [], goals: [], competitors: [] }))).toEqual(["basics"]);
    const ctx = buildContextFromProfile({ name: "A", stage: "IDEA", products: [{ name: "P", description: undefined }], services: [], audiences: [], problems: [{ problem: "x" }], goals: [{ title: "g" }], competitors: [{ name: "c" }] });
    expect(Object.keys(ctx).sort()).toEqual(["audience", "basics", "competitors", "goals", "offering"]);
    expect(ctx.offering.products).toEqual([{ name: "P" }]);
  });
});

describe("profile validation", () => {
  it("rejects non-http competitor websites", () => {
    const r = businessProfileSchema.safeParse({ name: "A", stage: "IDEA", competitors: [{ name: "c", website: "javascript:alert(1)" }] });
    expect(r.success).toBe(false);
    expect(businessProfileSchema.parse({ name: "A", stage: "IDEA", competitors: [{ name: "c", website: "" }] }).competitors[0].website).toBeUndefined();
  });
});
