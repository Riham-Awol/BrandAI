"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, CreditCard, Loader2, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STATUS = { ACTIVE: ["Active", "success"], TRIALING: ["Trial", "success"], PAST_DUE: ["Payment overdue", "warning"], CANCELED: ["Cancelled", "secondary"], INCOMPLETE: ["Incomplete", "warning"] };
const RESOURCES = [["members", "Team members"], ["businesses", "Businesses"], ["websites", "Websites"], ["clients", "Clients"]];

function bytes(n) {
  const v = Number(n);
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)} GB`;
  if (v >= 1024 ** 2) return `${Math.round(v / 1024 ** 2)} MB`;
  return `${Math.round(v / 1024)} KB`;
}

/** Meter: fill carries severity, the track is a lighter step of the same hue; state also in words + icon. */
function Meter({ label, used, limit, format = (v) => v.toLocaleString("en-GB") }) {
  const share = limit > 0 ? Math.min(1, used / limit) : used > 0 ? 1 : 0;
  const level = share >= 1 ? "full" : share >= 0.9 ? "high" : "ok";
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{format(used)} of {limit > 0 ? format(limit) : "—"}</span>
      </div>
      <div className={cn("h-2 overflow-hidden rounded-full", level === "ok" ? "bg-primary/15" : "bg-destructive/15")} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <div className={cn("h-full rounded-full", level === "ok" ? "bg-primary" : "bg-destructive")} style={{ width: `${share * 100}%` }} />
      </div>
      {level !== "ok" && <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3.5" aria-hidden="true" />{level === "full" ? "Limit reached" : "Almost at the limit"}</p>}
    </div>
  );
}

export function BillingSettings({ workspaceId, initial }) {
  const params = useSearchParams();
  const [b] = useState(initial);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}/billing`;
  const canBuy = b.permissions.canManage && b.payments.configured;

  async function go(key, path, body) {
    setBusy(key);
    setError(null);
    try {
      const { url } = await apiRequest(`${base}/${path}`, { method: "POST", body });
      window.location.assign(url);
    } catch (e) {
      setError(e.message);
      setBusy(null);
    }
  }

  const status = STATUS[b.status] ?? STATUS.ACTIVE;
  const cost = Number(b.usage.find((u) => u.metric === "AI_COST_MICRO_USD")?.used ?? 0) / 1e6;
  const storage = b.usage.find((u) => u.metric === "STORAGE_BYTES");
  return (
    <div className="grid max-w-4xl gap-6">
      {params.get("checkout") === "success" && <Alert variant="success"><CheckCircle2 /><AlertDescription>Thanks! Your payment went through. The new plan appears here as soon as Stripe confirms it (usually a few seconds; refresh if needed).</AlertDescription></Alert>}
      {params.get("credits") === "success" && <Alert variant="success"><CheckCircle2 /><AlertDescription>Thanks! Your credits appear here once Stripe confirms the payment.</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}

      <Card className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{b.planName} plan</h2>
            <Badge variant={status[1]}>{status[0]}</Badge>
            {b.source === "ADMIN" && <Badge>Set by Brand AI</Badge>}
          </div>
          {b.permissions.canManage && b.payments.hasCustomer && b.payments.configured && (
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => go("portal", "portal")}>{busy === "portal" ? <Loader2 className="animate-spin" /> : <CreditCard />} Manage billing</Button>
          )}
        </div>
        {b.isClient && <p className="text-sm text-muted-foreground">This client workspace uses {b.managedBy}&apos;s plan and AI credits.</p>}
        {b.currentPeriodEnd && <p className="text-sm text-muted-foreground">{b.cancelAtPeriodEnd ? "Ends" : "Renews"} on {new Date(b.currentPeriodEnd).toLocaleDateString()}.</p>}
        {b.status === "PAST_DUE" && <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="size-4" />Your last payment failed. Update your card in “Manage billing” to keep the plan.</p>}
        {!b.permissions.canManage && !b.isClient && <p className="text-sm text-muted-foreground">Only the workspace owner can change the plan.</p>}
      </Card>

      <Card className="gap-4">
        <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4" /> AI credits this month</h2>
        <Meter label="Monthly allowance (1 credit = 1 AI request)" used={b.credits.used} limit={b.credits.allowance} />
        <p className="text-sm text-muted-foreground">Extra credits: <span className="font-semibold text-foreground">{b.credits.extra.toLocaleString("en-GB")}</span> (used after the allowance; they don&apos;t expire). The allowance resets on the 1st of each month.</p>
        {!b.isClient && b.creditPacks.map((p) => (
          <div key={p.key} className="flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={!canBuy || !p.available || busy !== null} onClick={() => go(p.key, "credits", { pack: p.key })}>{busy === p.key && <Loader2 className="animate-spin" />} Buy {p.credits} credits · {p.priceLabel}</Button>
            {(!b.payments.configured || !p.available) && <span className="text-xs text-muted-foreground">Payments aren&apos;t set up on this server yet.</span>}
          </div>
        ))}
        {b.ledger.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">{b.ledger.map((e) => <li key={e.id} className="flex justify-between gap-2 px-3 py-2"><span>{e.note ?? e.kind.toLowerCase()} <span className="text-muted-foreground">· {new Date(e.createdAt).toLocaleDateString()}</span></span><span className="tabular-nums">{e.amount > 0 ? "+" : ""}{e.amount}</span></li>)}</ul>
        )}
      </Card>

      <Card className="gap-4">
        <h2 className="font-semibold">Usage and limits</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {RESOURCES.filter(([k]) => k !== "clients" || b.workspaceType === "AGENCY").map(([k, label]) => <Meter key={k} label={label} used={b.used[k]} limit={b.limits[k]} />)}
          {storage && <Meter label="File storage" used={Number(storage.used)} limit={Number(storage.limit)} format={bytes} />}
        </div>
        <p className="text-xs text-muted-foreground">Estimated AI cost this month: ${cost.toFixed(2)} (free AI providers cost $0).</p>
      </Card>

      {!b.isClient && (
        <section className="grid gap-3">
          <h2 className="font-semibold">Plans</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {b.plans.map((p) => {
              const current = p.key === b.plan;
              const agencyOnly = p.key === "AGENCY" && b.workspaceType !== "AGENCY";
              return (
                <Card key={p.key} className={cn("gap-3", current && "ring-2 ring-primary")}>
                  <div className="flex items-center justify-between"><h3 className="font-semibold">{p.name}</h3>{current && <Badge variant="success">Current</Badge>}</div>
                  <p><span className="text-2xl font-semibold">{p.priceLabel}</span>{p.interval && <span className="text-sm text-muted-foreground"> / {p.interval}</span>}</p>
                  <p className="text-sm text-muted-foreground">{p.summary}</p>
                  <ul className="grid gap-1 text-sm">
                    {[[p.limits.aiCredits.toLocaleString("en-GB"), "AI credits / month"], [p.limits.members, "team members"], [p.limits.businesses, "businesses"], [p.limits.websites, "websites"], ...(p.limits.clients ? [[p.limits.clients, "client workspaces"]] : []), [bytes(p.limits.storageBytes), "storage"]].map(([v, l]) => (
                      <li key={l} className="flex items-center gap-1.5"><Check className="size-3.5 text-success" aria-hidden="true" /><span className="font-medium">{v}</span> {l}</li>
                    ))}
                  </ul>
                  {!current && p.key !== "FREE" && b.permissions.canManage && (
                    agencyOnly ? <p className="text-xs text-muted-foreground">For agency workspaces (create one in Settings → Workspace).</p>
                      : <Button disabled={!canBuy || !p.available || busy !== null || (b.payments.hasCustomer && b.plan !== "FREE")} onClick={() => go(p.key, "checkout", { plan: p.key })}>{busy === p.key && <Loader2 className="animate-spin" />} Upgrade to {p.name}</Button>
                  )}
                  {!current && p.key !== "FREE" && b.permissions.canManage && b.plan !== "FREE" && b.payments.hasCustomer && <p className="text-xs text-muted-foreground">Switch plans in “Manage billing”.</p>}
                </Card>
              );
            })}
          </div>
          {!b.payments.configured && <p className="text-sm text-muted-foreground">Online payments aren&apos;t configured on this server yet (Stripe keys missing), so upgrades are unavailable. The Free plan works fully.</p>}
          <p className="text-xs text-muted-foreground">Payments are processed by Stripe; card details never reach Brand AI. Downgrading keeps existing items but blocks adding more above the new limits.</p>
        </section>
      )}
    </div>
  );
}
