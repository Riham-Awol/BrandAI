import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { getEnv } from "@/server/config/env.js";
import { logger } from "@/server/logger.js";
import { getPublishedSite } from "@/modules/website/service.js";
import { deviceFrom, isBot, optedOut, utcDay, verifyDeliveryToken, visitorHash } from "./tracking.js";

const secret = () => getEnv().NEXTAUTH_SECRET ?? "dev";

/** Tracking choices of a workspace (defaults when never saved). */
export async function loadAnalyticsSettings(workspaceId) {
  const row = await prisma.analyticsSettings.findUnique({ where: { workspaceId } });
  return row ?? { workspaceId, trackSiteVisits: true, trackEmailEngagement: true, retentionDays: 395 };
}

/**
 * Records one page view of a published site. Silently ignores bots, browsers
 * that opted out (GPC/DNT), unknown pages and workspaces that turned tracking
 * off. Returns true when a view was stored.
 */
export async function recordSiteView(siteKey, { pageSlug, source, ip, headers }) {
  const userAgent = headers.get("user-agent") ?? "";
  if (isBot(userAgent) || optedOut(headers)) return false;
  const site = await getPublishedSite(siteKey);
  if (!site || !site.config.pages.some((p) => p.slug === pageSlug)) return false;
  const settings = await loadAnalyticsSettings(site.website.workspaceId);
  if (!settings.trackSiteVisits) return false;
  const now = new Date();
  const day = utcDay(now);
  await prisma.siteView.create({
    data: {
      websiteId: site.website.id, workspaceId: site.website.workspaceId, day, path: pageSlug.slice(0, 64),
      referrerHost: source ? String(source).slice(0, 253) : null,
      visitorHash: visitorHash({ secret: secret(), day, siteId: site.website.id, ip, userAgent }),
      device: deviceFrom(userAgent),
    },
  });
  return true;
}

/**
 * Records the first open or click of a campaign email. Returns the campaign's
 * call-to-action URL for clicks (from the stored campaign, never from the
 * request), or null when the token is invalid.
 */
export async function recordEmailEvent(token, type, { headers, record = true }) {
  const deliveryId = verifyDeliveryToken(secret(), token);
  if (!deliveryId) return null;
  const delivery = await prisma.emailDelivery.findUnique({ where: { id: deliveryId }, select: { id: true, campaignId: true, campaign: { select: { workspaceId: true, content: true, deletedAt: true } } } });
  if (!delivery) return null;
  const ctaUrl = typeof delivery.campaign.content?.ctaUrl === "string" && /^https:\/\//.test(delivery.campaign.content.ctaUrl) ? delivery.campaign.content.ctaUrl : null;
  // Mail-security scanners prefetch links; an obvious bot doesn't count, but still gets redirected.
  const counts = !isBot(headers.get("user-agent")) || type === "open";
  const settings = await loadAnalyticsSettings(delivery.campaign.workspaceId);
  if (record && counts && settings.trackEmailEngagement) {
    await prisma.emailEvent
      .create({ data: { deliveryId, campaignId: delivery.campaignId, workspaceId: delivery.campaign.workspaceId, type } })
      .catch((error) => {
        if (error?.code !== "P2002") logger.warn("Email event not stored", { code: error?.code });
      });
    // A click proves the email was opened even when images were blocked.
    if (type === "click") {
      await prisma.emailEvent.create({ data: { deliveryId, campaignId: delivery.campaignId, workspaceId: delivery.campaign.workspaceId, type: "open" } }).catch(() => {});
    }
  }
  return { ctaUrl };
}

/** Deletes tracking rows older than each workspace's retention period. Called by the scheduler. */
export async function purgeOldTracking(now = new Date()) {
  const custom = await prisma.analyticsSettings.findMany({ select: { workspaceId: true, retentionDays: true } });
  const cutoff = (days) => new Date(now.getTime() - days * 86400000);
  let removed = 0;
  for (const s of custom) {
    removed += (await prisma.siteView.deleteMany({ where: { workspaceId: s.workspaceId, createdAt: { lt: cutoff(s.retentionDays) } } })).count;
    removed += (await prisma.emailEvent.deleteMany({ where: { workspaceId: s.workspaceId, createdAt: { lt: cutoff(s.retentionDays) } } })).count;
  }
  const others = { workspaceId: { notIn: custom.map((s) => s.workspaceId) }, createdAt: { lt: cutoff(395) } };
  removed += (await prisma.siteView.deleteMany({ where: others })).count;
  removed += (await prisma.emailEvent.deleteMany({ where: others })).count;
  return { removed };
}
