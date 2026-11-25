import "server-only";
import { prisma } from "../db/prisma.js";
import { AppError, Errors } from "../errors.js";
import { logger } from "../logger.js";
import { getEnv } from "../config/env.js";
import { recordAudit } from "../audit/service.js";
import { notify } from "../notifications/service.js";
import { enforceRateLimit } from "../rate-limit/index.js";
import { requireWorkspaceAccess } from "../permissions/authorize.js";
import { PERMISSIONS } from "../permissions/roles.js";
import { getUsageSummary } from "../usage/service.js";
import { deleteWorkspace } from "../workspaces/team-service.js";
import { applyPlanLimits, getCreditStatus, getEntitlements } from "./entitlements.js";
import { CREDIT_PACKS, PLANS, PLAN_KEYS, planInEffect } from "./plans.js";
import { stripeConfigured, stripeRequest, verifyStripeSignature } from "./stripe.js";

const app = () => getEnv().APP_URL.replace(/\/+$/, "");

function priceFor(plan) {
  const env = getEnv();
  return { PRO: env.STRIPE_PRICE_PRO, AGENCY: env.STRIPE_PRICE_AGENCY }[plan] ?? null;
}
function planForPrice(priceId) {
  const env = getEnv();
  if (priceId && priceId === env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId && priceId === env.STRIPE_PRICE_AGENCY) return "AGENCY";
  return null;
}
const packPrice = (key) => ({ credits_500: getEnv().STRIPE_PRICE_CREDITS_500 })[key] ?? null;

async function counts(workspaceId) {
  const [members, businesses, websites, clients] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.business.count({ where: { workspaceId, deletedAt: null } }),
    prisma.website.count({ where: { workspaceId, deletedAt: null } }),
    prisma.agencyClient.count({ where: { agencyWorkspaceId: workspaceId, status: { not: "ARCHIVED" } } }),
  ]);
  return { members, businesses, websites, clients };
}

/** Plan, AI credits, usage and the plan catalog for the Plan & usage page. */
export async function getBilling(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.USAGE_READ);
  const ent = await getEntitlements(scope.workspaceId);
  const [sub, credits, usage, used, ledger, agency] = await Promise.all([
    prisma.subscription.findUnique({ where: { workspaceId: ent.accountId } }),
    getCreditStatus(scope.workspaceId),
    getUsageSummary(user, scope.workspaceId),
    counts(scope.workspaceId),
    ent.isClient ? [] : prisma.aiCreditEntry.findMany({ where: { workspaceId: scope.workspaceId, kind: { not: "USAGE" } }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, amount: true, kind: true, note: true, createdAt: true } }),
    ent.isClient ? prisma.workspace.findUnique({ where: { id: ent.accountId }, select: { name: true } }) : null,
  ]);
  const env = getEnv();
  return {
    plan: ent.plan, planName: PLANS[ent.plan].name, status: sub?.status ?? "ACTIVE", source: sub?.source ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null, cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    isClient: ent.isClient, managedBy: agency?.name ?? null, workspaceType: scope.workspace.type,
    limits: PLANS[ent.plan].limits, used, credits, usage, ledger,
    plans: PLAN_KEYS.map((k) => ({ ...PLANS[k], available: k === "FREE" || Boolean(priceFor(k)) })),
    creditPacks: Object.values(CREDIT_PACKS).map((p) => ({ ...p, available: Boolean(packPrice(p.key)) })),
    payments: { configured: stripeConfigured() && Boolean(env.STRIPE_WEBHOOK_SECRET), hasCustomer: Boolean(sub?.stripeCustomerId) },
    permissions: { canManage: scope.can(PERMISSIONS.BILLING_MANAGE) && !ent.isClient },
  };
}

async function requireBillingScope(user, workspaceId) {
  const scope = await requireWorkspaceAccess(user, workspaceId, PERMISSIONS.BILLING_MANAGE);
  const ent = await getEntitlements(scope.workspaceId);
  if (ent.isClient) throw Errors.conflict("This client workspace is billed through its agency.");
  await enforceRateLimit("billing", `user:${user.id}`);
  return scope;
}

/** The workspace's Stripe customer (created on first checkout). */
async function ensureCustomer(scope, user) {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId: scope.workspaceId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;
  const customer = await stripeRequest("POST", "/customers", { email: user.email, name: scope.workspace.name, metadata: { workspaceId: scope.workspaceId } }, { idempotencyKey: `customer-${scope.workspaceId}` });
  await prisma.subscription.upsert({ where: { workspaceId: scope.workspaceId }, create: { workspaceId: scope.workspaceId, plan: "FREE", status: "ACTIVE", stripeCustomerId: customer.id }, update: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Stripe Checkout for a paid plan. Returns the hosted checkout URL. */
export async function startCheckout(user, workspaceId, { plan }, request) {
  const scope = await requireBillingScope(user, workspaceId);
  const price = priceFor(plan);
  if (!price || !stripeConfigured()) throw Errors.notConfigured(`Payments for the ${PLANS[plan]?.name ?? plan} plan (Stripe)`);
  if (plan === "AGENCY" && scope.workspace.type !== "AGENCY") throw Errors.conflict("The Agency plan is for agency workspaces. Create an agency workspace first.");
  const sub = await prisma.subscription.findUnique({ where: { workspaceId: scope.workspaceId } });
  if (sub?.stripeSubscriptionId && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(sub.status)) {
    throw new AppError("CONFLICT", "You already have a subscription. Change or cancel it in the billing portal.", 409);
  }
  const customer = await ensureCustomer(scope, user);
  const session = await stripeRequest("POST", "/checkout/sessions", {
    mode: "subscription", customer, client_reference_id: scope.workspaceId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${app()}/settings/billing?checkout=success`, cancel_url: `${app()}/settings/billing?checkout=cancelled`,
    metadata: { workspaceId: scope.workspaceId, kind: "plan", plan },
    subscription_data: { metadata: { workspaceId: scope.workspaceId } },
    allow_promotion_codes: true,
  });
  await recordAudit({ action: "billing.checkout_started", actorId: user.id, workspaceId, entityType: "workspace", entityId: workspaceId, metadata: { plan }, request });
  return { url: session.url };
}

/** Stripe Checkout for a one-time AI credit pack. */
export async function buyCredits(user, workspaceId, { pack }, request) {
  const scope = await requireBillingScope(user, workspaceId);
  const price = packPrice(pack);
  if (!price || !stripeConfigured()) throw Errors.notConfigured("Buying AI credits (Stripe)");
  const customer = await ensureCustomer(scope, user);
  const session = await stripeRequest("POST", "/checkout/sessions", {
    mode: "payment", customer, client_reference_id: scope.workspaceId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${app()}/settings/billing?credits=success`, cancel_url: `${app()}/settings/billing?credits=cancelled`,
    metadata: { workspaceId: scope.workspaceId, kind: "credits", pack },
  });
  await recordAudit({ action: "billing.credits_checkout_started", actorId: user.id, workspaceId, entityType: "workspace", entityId: workspaceId, metadata: { pack }, request });
  return { url: session.url };
}

/** Stripe's hosted billing portal: change plan, update card, invoices, cancel. */
export async function openBillingPortal(user, workspaceId) {
  const scope = await requireBillingScope(user, workspaceId);
  const sub = await prisma.subscription.findUnique({ where: { workspaceId: scope.workspaceId } });
  if (!sub?.stripeCustomerId) throw Errors.conflict("There's no billing account yet. Choose a plan first.");
  const session = await stripeRequest("POST", "/billing_portal/sessions", { customer: sub.stripeCustomerId, return_url: `${app()}/settings/billing` });
  return { url: session.url };
}

const STATUS = { active: "ACTIVE", trialing: "TRIALING", past_due: "PAST_DUE", unpaid: "PAST_DUE", canceled: "CANCELED", incomplete: "INCOMPLETE", incomplete_expired: "CANCELED", paused: "CANCELED" };

async function workspaceForStripe(object) {
  const id = object.metadata?.workspaceId ?? object.client_reference_id;
  if (id) {
    const ws = await prisma.workspace.findUnique({ where: { id }, select: { id: true } });
    if (ws) return ws.id;
  }
  const byCustomer = object.customer ? await prisma.subscription.findUnique({ where: { stripeCustomerId: String(object.customer) }, select: { workspaceId: true } }) : null;
  return byCustomer?.workspaceId ?? null;
}

async function notifyOwner(workspaceId, title, body) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
  if (ws) await notify({ userId: ws.ownerId, workspaceId, type: "billing", title, body, link: "/settings/billing" });
}

/** Mirrors a Stripe subscription into our table and applies the plan's limits. */
export async function syncSubscription(stripeSub) {
  const workspaceId = await workspaceForStripe(stripeSub);
  if (!workspaceId) {
    logger.warn("Stripe subscription for an unknown workspace", { id: stripeSub.id });
    return null;
  }
  const item = stripeSub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const plan = planForPrice(priceId);
  if (!plan) logger.warn("Stripe price doesn't match a configured plan", { priceId });
  const status = STATUS[stripeSub.status] ?? "INCOMPLETE";
  const periodEnd = stripeSub.current_period_end ?? item?.current_period_end;
  const data = {
    plan: plan ?? "FREE", status, source: "STRIPE", stripeSubscriptionId: stripeSub.id, stripePriceId: priceId,
    stripeCustomerId: stripeSub.customer ? String(stripeSub.customer) : undefined,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null, cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
  };
  const before = await prisma.subscription.findUnique({ where: { workspaceId } });
  // An older subscription's late events must not overwrite the current one.
  if (before?.stripeSubscriptionId && before.stripeSubscriptionId !== stripeSub.id && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(before.status) && status === "CANCELED") return before;
  const saved = await prisma.subscription.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data });
  const effective = planInEffect(saved);
  await applyPlanLimits(workspaceId, effective);
  if (planInEffect(before) !== effective) {
    await recordAudit({ action: "billing.plan_changed", workspaceId, entityType: "workspace", entityId: workspaceId, metadata: { from: planInEffect(before), to: effective, status } });
    await notifyOwner(workspaceId, `Your plan is now ${PLANS[effective].name}`, status === "CANCELED" ? "The subscription ended; Free plan limits apply." : "Thanks! The new limits apply right away.");
  }
  return saved;
}

/**
 * Stripe webhook: signature-checked, processed once per event id. Stripe
 * retries on any non-2xx, so handled-but-irrelevant events return 200.
 */
export async function handleStripeWebhook(rawBody, signature) {
  const event = verifyStripeSignature(rawBody, signature, getEnv().STRIPE_WEBHOOK_SECRET);
  try {
    await prisma.billingEvent.create({ data: { id: String(event.id).slice(0, 255), type: String(event.type).slice(0, 100) } });
  } catch (error) {
    if (error?.code === "P2002") return { duplicate: true };
    throw error;
  }
  try {
    const obj = event.data?.object ?? {};
    switch (event.type) {
      case "checkout.session.completed": {
        if (obj.mode === "payment" && obj.metadata?.kind === "credits" && obj.payment_status === "paid") {
          const workspaceId = await workspaceForStripe(obj);
          const pack = CREDIT_PACKS[obj.metadata.pack];
          if (workspaceId && pack) {
            await prisma.aiCreditEntry.create({ data: { workspaceId, amount: pack.credits, kind: "PURCHASE", reference: obj.id, note: `${pack.credits} AI credits` } }).catch((error) => {
              if (error?.code !== "P2002") throw error;
            });
            await recordAudit({ action: "billing.credits_purchased", workspaceId, entityType: "workspace", entityId: workspaceId, metadata: { credits: pack.credits } });
            await notifyOwner(workspaceId, `${pack.credits} AI credits added`, "They're used after your monthly allowance and don't expire.");
          }
        } else if (obj.mode === "subscription" && obj.subscription) {
          await syncSubscription(await stripeRequest("GET", `/subscriptions/${encodeURIComponent(obj.subscription)}`));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(obj);
        break;
      case "invoice.payment_failed": {
        const workspaceId = await workspaceForStripe(obj);
        if (workspaceId) await notifyOwner(workspaceId, "A payment failed", "Update your card in the billing portal to keep your plan.");
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // Let Stripe retry: forget the event so the retry is processed.
    await prisma.billingEvent.delete({ where: { id: String(event.id).slice(0, 255) } }).catch(() => {});
    throw error;
  }
  return { received: true, type: event.type };
}

/** Cancels a workspace's Stripe subscription immediately (workspace/account deletion). */
export async function cancelSubscriptionFor(workspaceId) {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!sub?.stripeSubscriptionId || !["ACTIVE", "TRIALING", "PAST_DUE", "INCOMPLETE"].includes(sub.status)) return;
  await stripeRequest("DELETE", `/subscriptions/${encodeURIComponent(sub.stripeSubscriptionId)}`);
  await prisma.subscription.update({ where: { workspaceId }, data: { status: "CANCELED" } });
}

export async function deleteWorkspaceWithBilling(user, workspaceId, input, request) {
  return deleteWorkspace(user, workspaceId, input, request, { beforeDelete: cancelSubscriptionFor });
}
