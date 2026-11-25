import "server-only";
import { prisma } from "@/server/db/prisma.js";
import { getEnv } from "@/server/config/env.js";
import { verifySvixSignature } from "@/server/email/webhook.js";
import { logRun } from "./history.js";

const REASON = { "email.bounced": "bounced", "email.complained": "complained" };

/**
 * Resend → Brand AI: a hard bounce or spam complaint stops all future campaign
 * email to that address from the workspace that sent it (sender reputation and
 * anti-spam law). Unknown messages are acknowledged and ignored.
 */
export async function handleEmailWebhook(rawBody, headers) {
  const event = verifySvixSignature(rawBody, headers, getEnv().RESEND_WEBHOOK_SECRET);
  const reason = REASON[event.type];
  const messageId = event.data?.email_id;
  if (!reason || typeof messageId !== "string") return { ignored: true };
  const delivery = await prisma.emailDelivery.findUnique({ where: { providerMessageId: messageId }, include: { contact: { select: { email: true, workspaceId: true } }, campaign: { select: { name: true } } } });
  if (!delivery) return { ignored: true };
  if (delivery.status === reason) return { duplicate: true };
  const { email, workspaceId } = delivery.contact;
  await prisma.$transaction([
    prisma.emailDelivery.update({ where: { id: delivery.id }, data: { status: reason, error: reason === "bounced" ? "Bounced (address doesn't accept mail)" : "Marked as spam by the recipient" } }),
    prisma.emailContact.updateMany({ where: { workspaceId, email, unsubscribedAt: null }, data: { unsubscribedAt: new Date(), suppressionReason: reason } }),
  ]);
  await logRun(workspaceId, { kind: "email", outcome: "FAILED", message: `${email} ${reason === "bounced" ? "bounced" : "reported spam"} on “${delivery.campaign.name}”; no more campaign emails will be sent to it.` });
  return { suppressed: reason };
}
