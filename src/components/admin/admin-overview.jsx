import { Card } from "@/components/ui/card";

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const money = (cents) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const usd = (micro) => `$${(Number(micro) / 1e6).toFixed(2)}`;

/** Platform overview (server component: numbers only, no client state). */
export function AdminOverview({ data }) {
  const ws = data.workspaces;
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Accounts" value={data.users.total.toLocaleString()} hint={`${data.users.new30d} new · ${data.users.active30d} active (30 days)`} />
        <Stat label="Workspaces" value={((ws.PERSONAL ?? 0) + (ws.TEAM ?? 0) + (ws.AGENCY ?? 0)).toLocaleString()} hint={`${ws.TEAM ?? 0} team · ${ws.AGENCY ?? 0} agency`} />
        <Stat label="Monthly recurring revenue" value={money(data.mrrCents)} hint="Active Stripe subscriptions at list price" />
        <Stat label="Paid plans" value={(data.plans.PRO + data.plans.AGENCY).toLocaleString()} hint={`${data.plans.PRO} Pro · ${data.plans.AGENCY} Agency${data.pastDue ? ` · ${data.pastDue} payment overdue` : ""}`} />
      </div>
      <Card className="gap-3">
        <h2 className="font-semibold">AI in the last 30 days</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Requests" value={data.ai.requests30d.toLocaleString()} />
          <Stat label="Failure rate" value={data.ai.failureRate == null ? "—" : `${(data.ai.failureRate * 100).toFixed(1)}%`} hint={`${data.ai.failed30d} failed`} />
          <Stat label="Estimated cost" value={usd(data.ai.costMicroUsd30d)} hint="Free providers cost $0" />
        </div>
        {data.ai.byModel.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">AI requests by model</caption>
              <thead className="text-left text-muted-foreground"><tr><th scope="col" className="py-2 font-medium">Provider</th><th scope="col" className="py-2 font-medium">Model</th><th scope="col" className="py-2 text-right font-medium">Requests</th><th scope="col" className="py-2 text-right font-medium">Cost</th></tr></thead>
              <tbody className="divide-y tabular-nums">{data.ai.byModel.map((m) => <tr key={`${m.provider}-${m.model}`}><td className="py-2">{m.provider}</td><td className="py-2">{m.model}</td><td className="py-2 text-right">{m.requests.toLocaleString()}</td><td className="py-2 text-right">{usd(m.costMicroUsd)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
