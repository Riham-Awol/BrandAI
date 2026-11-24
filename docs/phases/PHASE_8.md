# Phase 8 — AI Marketing Calendar & Automation

Status: COMPLETE (awaiting approval)

## 1. Scope
Everything lives under `/automation` (calendar, queue & approvals, email campaigns, audience, rules & reminders,
history, settings & channels), plus a notifications bell in the app header.

**Permission-based automation — three modes** (workspace setting, audited):
| Mode | What happens at the scheduled time |
|---|---|
| Draft only (default) | Nothing is published or sent. The item becomes "Post manually" and the scheduler notifies its author; a person posts it and marks it posted (or an owner/admin presses "Publish now"). |
| Approval required | Items go out automatically **only with a human approval** (owner/admin). Editors' items wait in the queue; optionally the approver must be a different person. Items approved only by policy are blocked and sent back for approval. |
| Authorized automation | Items go out without per-item approval, **within daily limits** (posts / emails per 24 h). Only the **owner** can switch this on (`automation:autopilot`). |

The runner re-checks the current mode, approval, channel state and limits at publish time, so tightening the
policy applies to items already scheduled. Spending: Brand AI takes no paid actions, so no spend can occur.

**Permissions** (`roles.js`): schedule = `business:update` (editors+); approve and "Publish now" =
`automation:approve` (admins, owners); settings, channels, rules = `automation:manage` (admins, owners);
authorized automation = `automation:autopilot` (owners).

**Content scheduling & approval workflow** (`scheduled_items`): social posts (caption composed from the post),
email campaigns and custom posts; Draft → Waiting for approval → Scheduled → Published / Post manually / Failed
(3 automatic retries) / Rejected / Cancelled. Content is snapshotted at scheduling; rescheduling an approved item
needs a fresh approval in approval mode. Items are claimed atomically and runs are serialized with a MySQL lease
lock, so nothing is published twice and limits can't be exceeded by concurrent runs.

**Integrations** (`integrations`, credentials AES-256-GCM encrypted with `INTEGRATIONS_ENCRYPTION_KEY`, never
returned by the API, wiped on removal):
- **Webhook** — signed JSON (`X-BrandAI-Signature: sha256=HMAC(secret, timestamp.body)`) to any https URL; connects
  any platform via Zapier/Make/n8n. SSRF protection: https on 443 only, no credentials, private/loopback/link-local
  ranges blocked **at connect time** (guarded DNS lookup, so DNS rebinding can't bypass it), no redirects.
- **Telegram channel** (Bot API) and **Facebook Page** (Graph API text posts with link).
- Instagram, TikTok, LinkedIn, X are listed as not available with the reason (platform-approved developer apps /
  paid API). No fake integrations.

**Email campaigns** (`email_campaigns`, `email_contacts`, `email_deliveries`): AI-drafted subject/body in the brand
voice (no invented offers), branded HTML built from validated content (escaped; https links only), sender address
and unsubscribe link in every email, `List-Unsubscribe` + one-click (RFC 8058) headers, test send to yourself,
scheduled sending through the queue, daily email limit, idempotent per-contact deliveries. **Audience** with
recorded consent (source + date + explicit confirmation), CSV import, unsubscribed people are never re-added by
import. Public unsubscribe page `/u/:token` (button confirmation so link scanners don't unsubscribe people).
Sending uses the platform email provider (Resend free tier or console in development — clearly labelled).

**Marketing calendar**: month grid (agenda on phones) with scheduled items, emails, planned-but-unscheduled social
posts, your reminders and invoice due dates.

**Rules** (preset recipes, no user code): queue posts marked Ready (at a time in the workspace time zone); remind
approvers; overdue invoice reminders; forward website messages to a webhook (external → only in authorized mode,
otherwise logged as blocked). **Reminders** become notifications when due. **History**: every decision (published,
skipped, blocked by policy, failed, mode changes, tests) with reasons.

**Scheduler**: `POST /api/v1/cron/run` with `Authorization: Bearer <CRON_SECRET>` (constant-time check), called by
any free scheduler every 5–15 min, plus "Run now" for admins. Example (GitHub Actions):
```yaml
on: { schedule: [{ cron: "*/10 * * * *" }] }
jobs:
  run: { runs-on: ubuntu-latest, steps: [{ run: 'curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://YOUR-APP/api/v1/cron/run' }] }
```

## 2. Database — migrations `phase8_automation`, `phase8_job_locks`
`automation_settings`, `integrations`, `scheduled_items`, `email_contacts`, `email_campaigns`, `email_deliveries`,
`reminders`, `automation_rules`, `automation_runs`, `job_locks`.

## 3. Acceptance criteria
- [x] Marketing calendar, content scheduling, approval workflows, authorized publishing.
- [x] Social integrations (webhook, Telegram, Facebook Page) with encrypted credentials and SSRF protection.
- [x] Email campaigns with consent, unsubscribe and limits; notifications; reminders; automation rules; history.
- [x] Draft-only, approval-required and authorized-automation modes; external actions follow explicit permissions.
- [x] Isolation and role tests; 390 px and dark mode; regression passes.

## 4. Tests
| Suite | New in Phase 8 |
|---|---|
| Unit (`automation.test.js`) | policy decisions, retries, time zones, SSRF address/URL checks, webhook signature, email escaping + unsubscribe, CSV parsing, schemas, role permissions — 13 |
| Integration (`automation.test.js`) | settings/roles; integrations (encryption, no secret leaks, SSRF, tests); all three modes incl. separate approver, policy re-checks, limits under concurrent runs, retries; campaigns (consent, import, AI draft, test send, limits, unsubscribe); reminders, rules (queueing, blocked forwarding), calendar; isolation — 9 |
| E2E | approval → draft-only → run now → post manually → history/notifications; audience → AI campaign → test send → schedule → reminders/rules/calendar; cron auth + isolation; mobile — 4 |
