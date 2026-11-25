#!/usr/bin/env node
/**
 * Load test against a running production build (never against production):
 *   APP_ENV=staging RATE_LIMIT_MULTIPLIER=1000 RATE_LIMIT_STORE=memory npx next start -p 3400
 *   BASE_URL=http://localhost:3400 node scripts/load-test.mjs
 * Creates a throwaway account, business and published site, then measures the
 * busiest endpoints. Prints p50/p97.5/p99 latency, throughput and error counts.
 */
import autocannon from "autocannon";

const BASE = process.env.BASE_URL ?? "http://localhost:3400";
const DURATION = Number(process.env.DURATION ?? 15);
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 20);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

let cookie = "";
async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", ...init, headers: { "content-type": "application/json", origin: BASE, cookie, ...(init.headers ?? {}) } });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = [cookie, ...set.map((c) => c.split(";")[0])].filter(Boolean).join("; ");
  return res;
}

async function setup() {
  const id = Math.random().toString(36).slice(2, 8);
  const email = `load-${id}@example.com`;
  const password = `load-pass-${id}-9`;
  if (!(await call("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ name: "Load Test", email, password }) })).ok) throw new Error("register failed");
  const csrf = await (await call("/api/auth/csrf")).json();
  await call("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, json: "true" }) });
  const me = await (await call("/api/v1/me")).json();
  const ws = me.data.workspaces[0].id;
  const biz = (await (await call(`/api/v1/workspaces/${ws}/businesses`, { method: "POST", body: JSON.stringify({ name: `Load Bakery ${id}`, stage: "STARTING" }) })).json()).data;
  const site = (await (await call(`/api/v1/workspaces/${ws}/websites`, { method: "POST", body: JSON.stringify({ businessId: biz.id, type: "BUSINESS", theme: "modern", generate: false }) })).json()).data;
  await call(`/api/v1/workspaces/${ws}/websites/${site.id}/publish`, { method: "POST" });
  return { ws, slug: site.slug };
}

function run(title, opts) {
  return new Promise((resolve, reject) => {
    autocannon({ url: `${BASE}${opts.path}`, connections: CONNECTIONS, duration: DURATION, headers: { "user-agent": UA, ...(opts.headers ?? {}) }, ...(opts.setupClient ? { setupClient: opts.setupClient } : {}) }, (err, r) => {
      if (err) return reject(err);
      resolve({ title, rps: Math.round(r.requests.average), p50: r.latency.p50, p975: r.latency.p97_5, p99: r.latency.p99, non2xx: r.non2xx, errors: r.errors, timeouts: r.timeouts, total: r.requests.total });
    });
  });
}

const { ws, slug } = await setup();
const auth = { cookie };
let ip = 0;
const results = [];
results.push(await run("Health check", { path: "/api/v1/health" }));
results.push(await run("Published website page (public)", { path: `/sites/${slug}` }));
results.push(await run("Page-view pixel (public, per-visitor IP)", {
  path: `/api/v1/sites/${slug}/px?p=home`,
  setupClient: (client) => client.setHeaders({ "user-agent": UA, "x-forwarded-for": `10.${(ip >> 16) & 255}.${(ip >> 8) & 255}.${ip++ & 255}` }),
}));
results.push(await run("Analytics report API (signed in, 30 days)", { path: `/api/v1/workspaces/${ws}/analytics?days=30`, headers: auth }));
results.push(await run("Dashboard page (signed in)", { path: "/dashboard", headers: auth }));
results.push(await run("Plan & usage API (signed in)", { path: `/api/v1/workspaces/${ws}/billing`, headers: auth }));
console.log(`\n${CONNECTIONS} connections × ${DURATION}s against ${BASE}\n`);
console.table(results);
