# Deploying Brand AI

Two supported paths. Both read all configuration from environment variables (see `.env.example`); nothing secret
is committed or baked into images.

| | A. Vercel + managed MySQL (free start) | B. One server with Docker Compose |
|---|---|---|
| Cost | $0 to start (Vercel Hobby is for non-commercial use; Pro is $20/month once you charge customers) | ~$6–15/month server + domain |
| Database | TiDB Cloud Serverless (free, MySQL-compatible) or any MySQL 8 host | MySQL 8 container |
| Scheduler | Free external cron (cron-job.org, GitHub Actions) | `scheduler` service (every 5 min) |
| Backups | Provider's automatic backups (+ `scripts/backup-db.sh` from any machine) | `backup` service (daily, 14 days) |
| Customers' custom domains | Added per domain in Vercel | Reverse proxy (Caddy) |

## Required environment variables (production)

| Variable | Value |
|---|---|
| `APP_ENV` | `production` (refuses mock AI and the console email provider) |
| `APP_URL`, `NEXTAUTH_URL` | the public https address, e.g. `https://yourbrand.com` |
| `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:PORT/brandai` (+ `?sslaccept=strict` for TiDB/remote hosts; `&connection_limit=10` on a server) |
| `NEXTAUTH_SECRET` | random, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `INTEGRATIONS_ENCRYPTION_KEY` | 32 random bytes, base64 (same command). **Back it up**: it encrypts two-factor secrets and channel credentials |
| `CRON_SECRET` | random string; the scheduler sends it as `Authorization: Bearer …` |
| `AI_TEXT_PROVIDER`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `AI_TEXT_FALLBACK_PROVIDERS` | free AI (Gemini, falling back to OpenRouter free models; add `cloudflare` and/or `groq` for more free capacity) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `GROQ_API_KEY` | optional extra free providers (Cloudflare Workers AI, Groq) |
| `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` | email (Resend free tier; verify your domain to email other people) |
| `STORAGE_PROVIDER` | `database` (simple, ≤5 MB files) or `s3` with `S3_*` (Cloudflare R2 free tier) |
| `RATE_LIMIT_STORE` | `database` |
| Optional | `STRIPE_*` (payments), `RESEND_WEBHOOK_SECRET` (bounces), `SITES_CNAME_TARGET` |

## A. Vercel + TiDB Cloud (free)

1. **Database**: tidbcloud.com → create a free (Serverless/Starter) cluster → *Connect* for host, user
   (`xxxx.root`) and password → SQL editor: `CREATE DATABASE brandai;`.
   `DATABASE_URL=mysql://USER:PASSWORD@HOST:4000/brandai?sslaccept=strict`
2. **Vercel**: *Add New → Project* → import the GitHub repository.
   - Build Command: `npx prisma migrate deploy && npm run build` (creates/updates tables on every deploy).
   - Add the environment variables above for Production (and Preview, with a separate database).
   - *Settings → Git → Production Branch*: the branch you deploy (or merge into `main`).
3. After the first deploy set `APP_URL`/`NEXTAUTH_URL` to the real `https://….vercel.app` (or your domain) and
   redeploy.
4. **Scheduler**: cron-job.org (free) → POST `https://YOUR-APP/api/v1/cron/run` every 15 minutes with header
   `Authorization: Bearer <CRON_SECRET>`. (Vercel Hobby cron runs only once a day.)
5. **First platform admin**: register, then in the TiDB SQL editor:
   `UPDATE brandai.users SET is_platform_admin = 1 WHERE email = 'you@example.com';`
   Turn on two-factor sign-in in Settings, then open `/admin`.

Notes: long AI generations run up to a few minutes; if a plan's function time limit is lower, some requests
can time out (retrying usually succeeds when a faster model answers). The free setup was configured but not
run end to end from the build environment (it has no access to Vercel or TiDB).

## B. One server (Docker Compose)

```bash
curl -fsSL https://get.docker.com | sh
git clone <repo> brandai && cd brandai
cp .env.example .env.production          # fill in; also MYSQL_PASSWORD and MYSQL_ROOT_PASSWORD
docker compose --env-file .env.production up -d --build
docker compose exec app npm run admin:grant -- you@example.com   # after registering
```

The app listens on `127.0.0.1:3000`; put Caddy in front for HTTPS:

```
yourbrand.com {
  reverse_proxy localhost:3000
}
```

Updates: `git pull && docker compose --env-file .env.production up -d --build` (migrations run on start; with
several app instances run `npx prisma migrate deploy` once as a release step instead).

Verified in the build environment: the image builds, starts as the non-root `node` user, applies migrations,
serves pages with the security headers and passes `/api/v1/health`.

## Payments (Stripe)

1. Stripe dashboard (test mode first): products **Pro** $19/month, **Agency** $79/month, **500 AI credits** $10
   one-time → copy price ids into `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`, `STRIPE_PRICE_CREDITS_500`; secret key
   into `STRIPE_SECRET_KEY`.
2. Webhook → `https://YOUR-APP/api/v1/billing/webhook`, events `checkout.session.completed`,
   `customer.subscription.created|updated|deleted`, `invoice.payment_failed` → `STRIPE_WEBHOOK_SECRET`.
3. Enable the Customer Portal (plan changes, card updates, cancellation).
4. Test with card `4242 4242 4242 4242`; switch to live keys when ready.

## Email (Resend)

Verify your sending domain (SPF/DKIM records), set `EMAIL_FROM` on that domain, and add a webhook to
`https://YOUR-APP/api/v1/email/webhook` for `email.bounced` and `email.complained` (`RESEND_WEBHOOK_SECRET`).

## After launch
- Uptime monitor on `/api/v1/health` (returns 503 if the database is unreachable).
- Follow [OPERATIONS.md](./OPERATIONS.md) for backups, restores, incidents and routine checks.
