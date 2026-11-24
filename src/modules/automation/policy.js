/**
 * The automation policy as a pure function: what may happen to a due item.
 *
 *  - DRAFT_ONLY: never publish automatically → "manual" (remind a person).
 *  - No channel (and not an email): there's nowhere to publish → "manual".
 *  - APPROVAL_REQUIRED: needs a human approval → else "needs_approval".
 *  - AUTOMATED: approved by policy is enough.
 *  - Channel disabled/removed → "fail"; daily limit reached → "postpone".
 */
export function decidePublish({ mode, item, integration, publishedLast24h, dailyPublishLimit, emailsLeftToday }) {
  if (mode === "DRAFT_ONLY") return { action: "manual", reason: "Draft-only mode: nothing is published automatically." };
  const isEmail = item.sourceType === "EMAIL_CAMPAIGN";
  if (!isEmail && !item.integrationId) return { action: "manual", reason: "No channel is connected for this item." };
  if (mode === "APPROVAL_REQUIRED" && !item.approvedById) return { action: "needs_approval", reason: "Approval-required mode: this item has no human approval." };
  if (isEmail) {
    if (emailsLeftToday <= 0) return { action: "postpone", reason: "Daily email limit reached." };
    return { action: "send_email" };
  }
  if (!integration) return { action: "fail", reason: "The channel was removed." };
  if (integration.status === "DISABLED") return { action: "fail", reason: "The channel is disabled." };
  if (publishedLast24h >= dailyPublishLimit) return { action: "postpone", reason: `Daily publishing limit (${dailyPublishLimit}) reached.` };
  return { action: "publish" };
}

export const MAX_ATTEMPTS = 3;

/** Retry with growing delays; give up after MAX_ATTEMPTS. Pure. */
export function nextRetry(attempts, now) {
  return attempts >= MAX_ATTEMPTS ? null : new Date(now.getTime() + attempts * 10 * 60000);
}

/** "HH:MM" on a calendar date (UTC date part) in an IANA time zone → UTC Date. Pure. */
export function zonedDateTime(dateYmd, hhmm, timeZone) {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(`${dateYmd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const asZoned = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess.getTime() - (asZoned - guess.getTime()));
}
