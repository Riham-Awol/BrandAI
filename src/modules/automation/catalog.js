/** Automation modes, channels, rule recipes and statuses (client-safe). */

export const MODES = {
  DRAFT_ONLY: {
    label: "Draft only",
    summary: "Nothing is published or sent automatically. At the planned time you get a reminder to post it yourself.",
  },
  APPROVAL_REQUIRED: {
    label: "Approval required",
    summary: "Scheduled items go out automatically only after an owner or admin approves each one.",
  },
  AUTOMATED: {
    label: "Authorized automation",
    summary: "Scheduled items go out automatically without per-item approval, within the daily limits below. Only the workspace owner can switch this on.",
  },
};
export const MODE_KEYS = Object.keys(MODES);

export const INTEGRATIONS = {
  WEBHOOK: {
    label: "Webhook (Zapier, Make, n8n…)",
    description: "Sends each published item as signed JSON to your URL — connect any platform through an automation tool.",
    fields: [{ key: "url", label: "HTTPS URL", secret: true, placeholder: "https://hooks.zapier.com/…" }],
  },
  TELEGRAM: {
    label: "Telegram channel",
    description: "Posts to a Telegram channel or group through your bot (free Telegram Bot API).",
    fields: [{ key: "botToken", label: "Bot token (from @BotFather)", secret: true }, { key: "chatId", label: "Channel username or chat ID", placeholder: "@yourchannel" }],
  },
  FACEBOOK_PAGE: {
    label: "Facebook Page",
    description: "Publishes text posts (with an optional link) to a Facebook Page via the Graph API.",
    fields: [{ key: "pageId", label: "Page ID" }, { key: "accessToken", label: "Page access token", secret: true }],
  },
};
export const INTEGRATION_TYPES = Object.keys(INTEGRATIONS);

/** Platforms that need an approved developer app (OAuth + platform review) — not available yet. */
export const UNSUPPORTED_CHANNELS = [
  { name: "Instagram", reason: "Requires a Meta app with Instagram content publishing approved by Meta and media hosting." },
  { name: "TikTok", reason: "Requires a TikTok developer app with the Content Posting API approved by TikTok." },
  { name: "LinkedIn", reason: "Requires a LinkedIn app with Community Management API access approved by LinkedIn." },
  { name: "X (Twitter)", reason: "Posting through the X API requires a paid API plan." },
];

export const STATUS_LABELS = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Waiting for approval",
  APPROVED: "Scheduled",
  REJECTED: "Rejected",
  PUBLISHING: "Publishing…",
  PUBLISHED: "Published",
  MANUAL_DUE: "Post manually",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const RULE_TEMPLATES = {
  queue_ready_posts: {
    label: "Queue posts marked Ready",
    description: "When a social post is marked Ready, add it to the schedule on its planned date (it then follows your approval mode).",
    external: false,
    params: ["integrationId", "time"],
  },
  approval_nudge: {
    label: "Remind approvers",
    description: "Notify owners and admins when items waiting for approval are due within the next 24 hours.",
    external: false,
    params: [],
  },
  invoice_overdue: {
    label: "Overdue invoice reminders",
    description: "Once a day, notify the team about sent invoices that are past their due date.",
    external: false,
    params: [],
  },
  forward_website_messages: {
    label: "Forward website messages to a webhook",
    description: "Send new contact and order messages from your websites to a webhook (e.g. your CRM). External action: runs only in Authorized automation mode.",
    external: true,
    params: ["integrationId"],
  },
};
export const RULE_TEMPLATE_KEYS = Object.keys(RULE_TEMPLATES);

export const OUTCOME_LABELS = { SUCCESS: "Done", SKIPPED: "Skipped", BLOCKED: "Blocked by policy", FAILED: "Failed" };
