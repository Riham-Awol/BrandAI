import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mockFixtureResponder } from "@/server/ai/providers/mock-fixtures.js";
import "@/modules/automation/mock-fixtures.js";
import { decidePublish, nextRetry, zonedDateTime, MAX_ATTEMPTS } from "@/modules/automation/policy.js";
import { assertSafeUrl, isPublicAddress } from "@/server/integrations/net-guard.js";
import { signWebhook } from "@/server/integrations/adapters.js";
import { contactsFromCsv, parseCsv, renderCampaignEmail } from "@/modules/automation/email-render.js";
import { aiCampaignSchema, campaignContentSchema, integrationSchema, reminderSchema, settingsSchema } from "@/modules/automation/schemas.js";
import { roleHasPermission, PERMISSIONS } from "@/server/permissions/roles.js";

const base = { mode: "AUTOMATED", item: { sourceType: "CUSTOM", integrationId: "i", approvedById: null }, integration: { status: "ACTIVE" }, publishedLast24h: 0, dailyPublishLimit: 5, emailsLeftToday: 10 };

describe("automation policy", () => {
  it("never publishes in draft-only mode or without a channel", () => {
    expect(decidePublish({ ...base, mode: "DRAFT_ONLY" }).action).toBe("manual");
    expect(decidePublish({ ...base, item: { ...base.item, integrationId: null } }).action).toBe("manual");
    expect(decidePublish({ ...base, mode: "DRAFT_ONLY", item: { sourceType: "EMAIL_CAMPAIGN", integrationId: null } }).action).toBe("manual");
  });
  it("requires a human approval in approval mode", () => {
    expect(decidePublish({ ...base, mode: "APPROVAL_REQUIRED" }).action).toBe("needs_approval");
    expect(decidePublish({ ...base, mode: "APPROVAL_REQUIRED", item: { ...base.item, approvedById: "u" } }).action).toBe("publish");
  });
  it("enforces limits and channel state", () => {
    expect(decidePublish(base).action).toBe("publish");
    expect(decidePublish({ ...base, publishedLast24h: 5 }).action).toBe("postpone");
    expect(decidePublish({ ...base, dailyPublishLimit: 0 }).action).toBe("postpone");
    expect(decidePublish({ ...base, integration: null }).action).toBe("fail");
    expect(decidePublish({ ...base, integration: { status: "DISABLED" } }).action).toBe("fail");
    expect(decidePublish({ ...base, item: { sourceType: "EMAIL_CAMPAIGN", integrationId: null }, emailsLeftToday: 0 }).action).toBe("postpone");
    expect(decidePublish({ ...base, item: { sourceType: "EMAIL_CAMPAIGN", integrationId: null } }).action).toBe("send_email");
  });
  it("retries with growing delays, then gives up", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(nextRetry(1, now).toISOString()).toBe("2026-01-01T00:10:00.000Z");
    expect(nextRetry(2, now).toISOString()).toBe("2026-01-01T00:20:00.000Z");
    expect(nextRetry(MAX_ATTEMPTS, now)).toBeNull();
  });
  it("converts local times in a time zone, including daylight saving", () => {
    expect(zonedDateTime("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedDateTime("2026-12-01", "09:00", "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(zonedDateTime("2026-12-01", "09:00", "Asia/Kolkata").toISOString()).toBe("2026-12-01T03:30:00.000Z");
  });
});

describe("network guard (SSRF)", () => {
  it("classifies addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPublicAddress(ip)).toBe(true);
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "not-an-ip"]) expect(isPublicAddress(ip)).toBe(false);
  });
  it("accepts only public https URLs on 443 without credentials", () => {
    expect(assertSafeUrl("https://hooks.zapier.com/x").host).toBe("hooks.zapier.com");
    for (const url of ["http://hooks.zapier.com/x", "https://localhost/x", "https://169.254.169.254/latest", "https://a.internal/x", "https://h.com:8443/x", "https://u:p@h.com/x", "ftp://h.com", "nonsense"]) {
      expect(() => assertSafeUrl(url)).toThrow();
    }
  });
});

describe("webhooks", () => {
  it("signs timestamp.body with HMAC-SHA256", () => {
    const sig = signWebhook("secret", "1700000000", '{"a":1}');
    expect(sig).toBe(`sha256=${createHmac("sha256", "secret").update('1700000000.{"a":1}').digest("hex")}`);
  });
});

describe("campaign email", () => {
  it("escapes all content and always includes address and unsubscribe link", () => {
    const { html, text } = renderCampaignEmail({ subject: "<b>Hi</b>", preheader: "pre", content: { heading: "<script>x</script>", paragraphs: ['A "quote" & <img src=x onerror=1>'], ctaLabel: "Go", ctaUrl: "https://k.example/?a=1&b=2" }, brandName: "K & Co", colors: { primary: "#ffff00" }, senderAddress: "1 Market St", unsubscribeUrl: "https://app.example/u/tok" });
    expect(html).not.toMatch(/<script>|<img src=x/);
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).toContain('href="https://k.example/?a=1&amp;b=2"');
    expect(html).toContain("K &amp; Co · 1 Market St");
    expect(html).toContain('href="https://app.example/u/tok"');
    expect(html).toContain("background:#302442"); // low-contrast brand colour falls back
    expect(text).toContain("Unsubscribe: https://app.example/u/tok");
  });
  it("parses CSV with quotes and finds the email column", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3')).toEqual([["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
    expect(contactsFromCsv("Name,E-mail address\nAnn,ANN@x.com\nBob,bad\nAnn2,ann@x.com\n")).toEqual({ contacts: [{ email: "ann@x.com", name: "Ann" }], invalid: 1 });
    expect(contactsFromCsv("bob@x.com,Bob").contacts).toEqual([{ email: "bob@x.com", name: "Bob" }]);
  });
  it("AI fixture and content schemas", () => {
    expect(aiCampaignSchema.safeParse(mockFixtureResponder({ module: "automation", task: "email_campaign" }).data).success).toBe(true);
    expect(campaignContentSchema.safeParse({ heading: "", paragraphs: [], ctaLabel: "", ctaUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("schemas and permissions", () => {
  it("validates channels, settings and reminders", () => {
    expect(integrationSchema.safeParse({ type: "TELEGRAM", name: "x", botToken: "123456789:AAEhBP0av28kqx-Ab1cDEfghIJKlmnoPqRS", chatId: "@chan_name" }).success).toBe(true);
    expect(integrationSchema.safeParse({ type: "TELEGRAM", name: "x", botToken: "nope", chatId: "@chan" }).success).toBe(false);
    expect(integrationSchema.safeParse({ type: "FACEBOOK_PAGE", name: "x", pageId: "abc", accessToken: "x".repeat(30) }).success).toBe(false);
    expect(integrationSchema.safeParse({ type: "SLACK", name: "x" }).success).toBe(false);
    expect(settingsSchema.safeParse({ mode: "AUTOMATED", dailyPublishLimit: 5, dailyEmailLimit: 10, requireSeparateApprover: true, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(reminderSchema.safeParse({ title: "x", dueAt: new Date().toISOString(), link: "https://evil.example" }).success).toBe(false);
  });
  it("only owners can switch on autopilot; editors can't approve", () => {
    expect(roleHasPermission("OWNER", PERMISSIONS.AUTOMATION_AUTOPILOT)).toBe(true);
    expect(roleHasPermission("ADMIN", PERMISSIONS.AUTOMATION_AUTOPILOT)).toBe(false);
    expect(roleHasPermission("ADMIN", PERMISSIONS.AUTOMATION_APPROVE)).toBe(true);
    expect(roleHasPermission("EDITOR", PERMISSIONS.AUTOMATION_APPROVE)).toBe(false);
    expect(roleHasPermission("VIEWER", PERMISSIONS.AUTOMATION_MANAGE)).toBe(false);
  });
});
