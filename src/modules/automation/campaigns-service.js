import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { AppError, Errors } from "@/server/errors.js";
import { recordAudit } from "@/server/audit/service.js";
import { generateText } from "@/server/ai/orchestrator.js";
import { requireWorkspaceAccess } from "@/server/permissions/authorize.js";
import { PERMISSIONS } from "@/server/permissions/roles.js";
import { findScopedBusiness } from "@/server/businesses/service.js";
import { resolveBrand } from "@/server/brand/approved-brand.js";
import { getEnv } from "@/server/config/env.js";
import { emailProviderName, sendEmail } from "@/server/email/index.js";
import { logger } from "@/server/logger.js";
import { uuidSchema } from "@/validation/common.js";
import { addressLines } from "@/modules/stationery/details.js";
import { loadDetails } from "@/modules/stationery/details-service.js";
import { aiCampaignSchema } from "./schemas.js";
import { renderCampaignEmail } from "./email-render.js";
import { loadSettings } from "./settings-service.js";
import { logRun } from "./history.js";
import { signDeliveryToken } from "@/modules/analytics/tracking.js";
import { loadAnalyticsSettings } from "@/modules/analytics/tracking-service.js";
import "./mock-fixtures.js";

const select = { id: true, businessId: true, name: true, subject: true, preheader: true, content: true, status: true, sentCount: true, failedCount: true, sentAt: true, isMock: true, createdAt: true, updatedAt: true, business: { select: { id: true, name: true } } };

async function findCampaign(scope, id) {
  if (!uuidSchema.safeParse(id).success) throw Errors.notFound();
  const c = await prisma.emailCampaign.findFirst({ where: { id, workspaceId: scope.workspaceId, deletedAt: null }, select });
  if (!c) throw Errors.notFound();
  return c;
}

export async function listCampaigns(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  return prisma.emailCampaign.findMany({ where: { workspaceId: scope.workspaceId, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 200, select });
}

export async function getCampaign(user, workspaceId, id) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const c = await findCampaign(scope, id);
  const recipients = await prisma.emailContact.count({ where: { businessId: c.businessId, workspaceId: scope.workspaceId, unsubscribedAt: null } });
  return { ...c, recipients, provider: emailProviderName(), permissions: { canEdit: scope.can(PERMISSIONS.BUSINESS_UPDATE), canSend: scope.can(PERMISSIONS.AUTOMATION_APPROVE) } };
}

export async function createCampaign(user, workspaceId, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  await findScopedBusiness(scope, input.businessId);
  const c = await prisma.emailCampaign.create({ data: { workspaceId: scope.workspaceId, businessId: input.businessId, name: input.name, subject: input.subject, preheader: input.preheader, content: input.content, isMock: Boolean(input.isMock), createdById: user.id }, select: { id: true } });
  await recordAudit({ action: "campaign.created", actorId: user.id, workspaceId, entityType: "email_campaign", entityId: c.id, request });
  return getCampaign(user, workspaceId, c.id);
}

export async function updateCampaign(user, workspaceId, id, input, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const c = await findCampaign(scope, id);
  if (c.status !== "DRAFT") throw new AppError("CONFLICT", "Only draft campaigns can be edited. Cancel its schedule first.", 409);
  await prisma.emailCampaign.update({ where: { id: c.id }, data: { name: input.name, subject: input.subject, preheader: input.preheader, content: input.content } });
  await recordAudit({ action: "campaign.updated", actorId: user.id, workspaceId, entityType: "email_campaign", entityId: c.id, request });
  return getCampaign(user, workspaceId, c.id);
}

export async function deleteCampaign(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const c = await findCampaign(scope, id);
  if (!["DRAFT", "FAILED"].includes(c.status)) throw new AppError("CONFLICT", "Scheduled or sent campaigns can't be deleted.", 409);
  await prisma.emailCampaign.update({ where: { id: c.id }, data: { deletedAt: new Date() } });
  await recordAudit({ action: "campaign.deleted", actorId: user.id, workspaceId, entityType: "email_campaign", entityId: c.id, request });
}

/** AI-written subject, preheader and body in the brand voice (not saved; no invented offers). */
export async function draftCampaign(user, workspaceId, { businessId, brief }, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.AI_GENERATE);
  const business = await findScopedBusiness(scope, businessId);
  const result = await generateText({
    user, workspaceId, businessId: business.id, module: "automation", task: "email_campaign",
    instructions: "You write a short marketing email for a small business in its approved brand voice. Plain, warm, specific; no spam-trigger words, no ALL CAPS, no misleading subject lines. Never invent discounts, prices, dates or claims that are not in the brief or context. Return a subject (≤ 60 chars), preheader (≤ 90 chars), heading, 2–4 short paragraphs and a button label.",
    input: `<business>\nName: ${business.name}\nIndustry: ${business.industry ?? "not specified"}\n</business>\n\n<brief>\n${brief}\n</brief>`,
    schema: aiCampaignSchema, effort: "low", maxTokens: 2000, request,
  });
  const d = result.data;
  const clip = (s, n) => String(s ?? "").trim().slice(0, n);
  return { subject: clip(d.subject, 200), preheader: clip(d.preheader, 200), content: { heading: clip(d.heading, 160), paragraphs: d.paragraphs.map((p) => clip(p, 1500)).filter(Boolean).slice(0, 8), ctaLabel: clip(d.ctaLabel, 40), ctaUrl: "" }, isMock: result.isMock };
}

async function renderFor(campaign, contactToken, { deliveryId = null } = {}) {
  const business = await prisma.business.findUnique({ where: { id: campaign.businessId }, select: { id: true, name: true } });
  const [brand, details] = await Promise.all([resolveBrand(business.id, business), loadDetails(business.id)]);
  const app = getEnv().APP_URL.replace(/\/+$/, "");
  const unsubscribeUrl = `${app}/u/${contactToken}`;
  let tracking = {};
  if (deliveryId && (await loadAnalyticsSettings(campaign.workspaceId)).trackEmailEngagement) {
    const token = signDeliveryToken(getEnv().NEXTAUTH_SECRET ?? "dev", deliveryId);
    tracking = { openPixelUrl: `${app}/api/v1/email/${token}/open`, ctaHref: campaign.content.ctaUrl ? `${app}/api/v1/email/${token}/click` : undefined };
  }
  const { html, text } = renderCampaignEmail({ subject: campaign.subject, preheader: campaign.preheader, content: campaign.content, brandName: details?.legalName || brand.name, colors: brand.colors, senderAddress: addressLines(details).join(", "), unsubscribeUrl, ...tracking });
  return { html, text, unsubscribeUrl, headers: { "List-Unsubscribe": `<${app}/api/v1/unsubscribe/${contactToken}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
}

export async function previewCampaign(user, workspaceId, id) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_READ);
  const c = await findCampaign(scope, id);
  return (await renderFor(c, "preview-token-preview-token-preview-token-x")).html;
}

/** Sends a test copy to the signed-in user (not to the audience). */
export async function sendTestEmail(user, workspaceId, id, request) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BUSINESS_UPDATE);
  const c = await findCampaign(scope, id);
  const msg = await renderFor(c, "test-token-test-token-test-token-test-tokenx");
  await sendEmail({ to: user.email, subject: `[Test] ${c.subject}`, text: msg.text, html: msg.html });
  await recordAudit({ action: "campaign.test_sent", actorId: user.id, workspaceId, entityType: "email_campaign", entityId: c.id, request });
  return { sentTo: user.email, provider: emailProviderName() };
}

/** Emails sent by the workspace in the last 24 hours (for the daily limit). */
export async function emailsSentLast24h(workspaceId, now = new Date()) {
  return prisma.emailDelivery.count({ where: { campaign: { workspaceId }, createdAt: { gte: new Date(now.getTime() - 86400000) } } });
}

/**
 * Sends to subscribed contacts not yet emailed for this campaign, up to the
 * daily limit. Idempotent (one delivery row per contact). Returns progress.
 * Callers decide whether sending is allowed (mode / approval / person).
 */
export async function sendCampaignBatch(workspaceId, campaignId, { now = new Date(), actorId = null } = {}) {
  const campaign = await prisma.emailCampaign.findFirst({ where: { id: campaignId, workspaceId, deletedAt: null } });
  if (!campaign) throw Errors.notFound();
  const settings = await loadSettings(workspaceId);
  const allowance = Math.max(0, settings.dailyEmailLimit - (await emailsSentLast24h(workspaceId, now)));
  const pending = await prisma.emailContact.findMany({ where: { businessId: campaign.businessId, workspaceId, unsubscribedAt: null, deliveries: { none: { campaignId } } }, orderBy: { createdAt: "asc" }, take: allowance });
  await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: "SENDING" } });
  const provider = emailProviderName();
  let sent = 0;
  let failed = 0;
  for (const contact of pending) {
    const delivery = await prisma.emailDelivery.create({ data: { campaignId, contactId: contact.id, status: "sending", provider } }).catch(() => null);
    if (!delivery) continue; // another runner already took this contact
    try {
      const msg = await renderFor(campaign, contact.unsubscribeToken, { deliveryId: delivery.id });
      await sendEmail({ to: contact.email, subject: campaign.subject, text: msg.text, html: msg.html, headers: msg.headers });
      await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: provider === "console" ? "logged" : "sent", sentAt: new Date() } });
      sent++;
    } catch (error) {
      logger.warn("Campaign email failed", { campaignId, code: error?.code });
      await prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: "failed", error: String(error?.message ?? "failed").slice(0, 300) } });
      failed++;
    }
  }
  const remaining = await prisma.emailContact.count({ where: { businessId: campaign.businessId, workspaceId, unsubscribedAt: null, deliveries: { none: { campaignId } } } });
  const totals = await prisma.emailDelivery.groupBy({ by: ["status"], where: { campaignId }, _count: true });
  const count = (s) => totals.filter((t) => s.includes(t.status)).reduce((a, t) => a + t._count, 0);
  const done = remaining === 0;
  await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status: done ? (count(["sent", "logged"]) === 0 && count(["failed"]) > 0 ? "FAILED" : "SENT") : "SENDING", sentCount: count(["sent", "logged"]), failedCount: count(["failed"]), ...(done ? { sentAt: now } : {}) } });
  await logRun(workspaceId, { kind: "email", outcome: failed && !sent ? "FAILED" : "SUCCESS", message: `Campaign “${campaign.name}”: ${sent} ${provider === "console" ? "logged (development provider — not delivered)" : "sent"}, ${failed} failed${remaining ? `, ${remaining} waiting for tomorrow's limit` : ""}.`, actorId, details: { sent, failed, remaining, provider } });
  return { sent, failed, remaining, done, provider };
}
