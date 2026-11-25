# Operations runbook

## Routine
| When | What |
|---|---|
| Every 5–15 min | Scheduler calls `POST /api/v1/cron/run` (publishing, campaigns, reminders, analytics retention) |
| Daily | Database backup (`scripts/backup-db.sh` or the compose `backup` service) |
| Weekly | Glance at `/admin` (AI failure rate, payments overdue) and `/admin/ai` provider health |
| Monthly | **Test a restore** into a scratch database; review `npm audit`; rotate any key that may have leaked |

## Backups and restore
- Backup: `DATABASE_URL=… BACKUP_DIR=/var/backups/brandai ./scripts/backup-db.sh`
  Consistent online dump (`--single-transaction`), gzip, SHA-256 checksum, 14-day retention
  (`BACKUP_RETENTION_DAYS`). `BACKUP_S3_URI` copies it off-site when the AWS CLI is installed (the compose
  `backup` container doesn't include it; copy the `backups` volume off the server another way, or run the script
  from a machine with the AWS CLI).
- Restore into an **empty** database (refuses otherwise unless `--force`):
  `DATABASE_URL=mysql://…/brandai_restore ./scripts/restore-db.sh backup.sql.gz` then `npx prisma migrate status`.
- Verified 2026-11-25: backup → restore into a new database → identical row counts in users, workspaces,
  businesses, site_views and audit_logs; schema up to date; overwrite guard refused a second restore.
- Keep `INTEGRATIONS_ENCRYPTION_KEY` and `NEXTAUTH_SECRET` with the backups (in a password manager): a restored
  database without the same encryption key can't decrypt two-factor secrets or channel credentials.

## Incidents
| Situation | Action |
|---|---|
| AI provider outage or cost spike | `/admin/ai` → **Pause all AI** (with a message). Users see it instead of errors. Resume when fixed. |
| Abusive account | `/admin/users` → Suspend (sessions end immediately; reason goes to the audit log). |
| Abusive or compromised workspace | `/admin/workspaces` → Suspend. |
| Spam sign-ups | `/admin/ai` → Close sign-ups (invited people can still register). |
| Leaked secret | Rotate it at the provider, update the environment, redeploy. `NEXTAUTH_SECRET` rotation signs everyone out. |
| Payment problems | Stripe dashboard; the webhook is idempotent, so "resend" from Stripe is safe. |
| Database unreachable | `/api/v1/health` returns 503; check the provider, then restore from the latest backup if needed. |

## Granting platform admin
Only from the command line (never from the web app): `npm run admin:grant -- email` (`--revoke` to remove), or on
hosts without shell access an SQL `UPDATE users SET is_platform_admin = 1 …`. Admins must use two-factor sign-in.

## Load testing (staging only)
```
APP_ENV=staging RATE_LIMIT_MULTIPLIER=1000 RATE_LIMIT_STORE=memory npx next start -p 3400
BASE_URL=http://localhost:3400 node scripts/load-test.mjs
```
`RATE_LIMIT_MULTIPLIER` is ignored when `APP_ENV=production`. Results: [PERFORMANCE.md](./PERFORMANCE.md).
