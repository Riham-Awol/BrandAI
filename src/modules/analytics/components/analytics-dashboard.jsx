"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, Download, FileText, Info, Loader2, Printer, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/modules/stationery/money.js";
import { PERIODS, formatValue } from "../metrics.js";
import { BarList, DailyLineChart, KpiTile } from "./charts";
import { InsightsView } from "./insights-view";

const SECTIONS = [
  ["website", "Website traffic & conversions"],
  ["email", "Email campaigns"],
  ["engagement", "Social engagement"],
  ["publishing", "Publishing"],
  ["sales", "Sales"],
];

const isEmpty = (kpis) => kpis.every((k) => !k.value && !k.previous);

function Section({ title, children, gaps, empty, emptyAction }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {gaps?.map((g) => (
        <p key={g.message} className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{g.message}</p>
      ))}
      {empty ? emptyAction : children}
    </section>
  );
}

function Tiles({ kpis, days }) {
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{kpis.map((k) => <KpiTile key={k.key} kpi={k} days={days} />)}</div>;
}

function SimpleTable({ caption, columns, rows, empty }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-left text-muted-foreground"><tr>{columns.map((c) => <th key={c.label} scope="col" className={cn("px-3 py-2 font-medium", c.num && "text-right")}>{c.label}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c.label} className={cn("px-3 py-2", c.num && "text-right tabular-nums")}>{c.value(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/**
 * Analytics overview. Filters (period, business) sit in one row above
 * everything they scope; on change the previous numbers stay on screen,
 * dimmed, until the new ones arrive.
 */
export function AnalyticsDashboard({ workspaceId, businesses, initialReport, initialQuery, latestReport, canGenerate }) {
  const [report, setReport] = useState(initialReport);
  const [query, setQuery] = useState(initialQuery);
  const [saved, setSaved] = useState(latestReport);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [pending, startTransition] = useTransition();
  const base = `/api/v1/workspaces/${workspaceId}/analytics`;
  const qs = (q) => `days=${q.days}${q.businessId ? `&businessId=${q.businessId}` : ""}`;
  const days = report.period.days;

  function change(next) {
    const q = { ...query, ...next };
    setQuery(q);
    setError(null);
    window.history.replaceState(null, "", `/analytics?${qs(q)}`);
    startTransition(async () => {
      try {
        const [r, reports] = await Promise.all([apiRequest(`${base}?${qs(q)}`), apiRequest(`${base}/reports${q.businessId ? `?businessId=${q.businessId}` : ""}`)]);
        setReport(r);
        setSaved(reports.find((x) => x.periodDays === q.days && (x.businessId ?? null) === (q.businessId ?? null)) ?? null);
      } catch (e) {
        setError(e.message);
      }
    });
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      setSaved(await apiRequest(`${base}/insights`, { method: "POST", body: { days: query.days, businessId: query.businessId ?? "" } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  const gaps = (area) => report.gaps.filter((g) => g.area === area);
  const w = report.website;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div role="radiogroup" aria-label="Period" className="inline-flex rounded-full border bg-card p-1">
          {PERIODS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={query.days === d} onClick={() => change({ days: d })} className={cn("rounded-full px-3 py-1.5 text-sm", query.days === d ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
              {d} days
            </button>
          ))}
        </div>
        {businesses.length > 1 && (
          <NativeSelect aria-label="Business" className="w-auto min-w-44" value={query.businessId ?? ""} onChange={(e) => change({ businessId: e.target.value || undefined })}>
            <option value="">All businesses</option>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild><a href={`${base}/export?${qs(query)}&format=csv`} download><Download /> CSV</a></Button>
          <Button variant="outline" size="sm" asChild><a href={`${base}/export?${qs(query)}&format=md`} download><FileText /> Markdown</a></Button>
        </div>
      </div>
      {pending && <p role="status" className="sr-only">Updating…</p>}
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className={cn("space-y-8 transition-opacity", pending && "opacity-50")} aria-busy={pending}>
        <Card className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Sparkles className="size-4" aria-hidden="true" /> Insights & recommendations</h2>
              <p className="text-sm text-muted-foreground">{saved ? `Written ${new Date(saved.createdAt).toLocaleString()} for the last ${saved.periodDays} days.` : `AI reads the numbers below and suggests what to do next.`}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {saved && <Button variant="outline" size="sm" asChild><Link href={`/print/analytics/${saved.id}`}><Printer /> Print report</Link></Button>}
              {canGenerate && <Button size="sm" disabled={generating || pending} onClick={generate}>{generating ? <Loader2 className="animate-spin" /> : <Sparkles />} {saved ? "Refresh insights" : "Get insights"}</Button>}
            </div>
          </div>
          {generating && <p role="status" className="text-sm text-muted-foreground">Analysing your numbers… this can take up to a minute.</p>}
          {saved ? <InsightsView insights={saved.insights} metrics={saved.metrics} isMock={saved.isMock} /> : !generating && <p className="text-sm text-muted-foreground">{canGenerate ? "No insights for this period yet." : "Ask an editor to generate insights."}</p>}
        </Card>

        <Section title={SECTIONS[0][1]} gaps={gaps("website")} empty={!w.sites && isEmpty(w.kpis)} emptyAction={<Button variant="outline" size="sm" asChild><Link href="/websites">Build a website</Link></Button>}>
          <Tiles kpis={w.kpis} days={days} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-3">
              <DailyLineChart title="Visitors and page views per day" rows={w.daily} series={[{ key: "visitors", label: "Visitors", color: "--chart-1" }, { key: "pageviews", label: "Page views", color: "--chart-2" }]} />
            </Card>
            <Card><BarList title="Top pages" rows={w.pages} labelKey="path" labelFor={(r) => (r.other ? "Other pages" : `/${r.path === "home" ? "" : r.path}`)} empty="No page views yet." /></Card>
            <Card><BarList title="Where visitors came from" rows={w.sources} labelKey="source" labelFor={(r) => (r.source.startsWith("utm:") ? `${r.source.slice(4)} (campaign link)` : r.source)} empty="No visits yet." /></Card>
            <Card><BarList title="Devices" rows={w.devices} labelKey="device" labelFor={(r) => r.device[0].toUpperCase() + r.device.slice(1)} empty="No visits yet." /></Card>
          </div>
          <p className="text-xs text-muted-foreground">Cookieless and privacy-friendly: no personal data is stored, visitors who ask not to be tracked (Do Not Track / Global Privacy Control) and bots are not counted. Add <code className="rounded bg-muted px-1">?utm_source=name</code> to links you share to see them here.</p>
        </Section>

        <Section title={SECTIONS[1][1]} gaps={gaps("email")} empty={isEmpty(report.email.kpis)} emptyAction={<Button variant="outline" size="sm" asChild><Link href="/automation/campaigns">Go to email campaigns</Link></Button>}>
          <Tiles kpis={report.email.kpis} days={days} />
          <SimpleTable caption="Campaigns" empty="No campaigns sent in this period." rows={report.email.campaigns} columns={[
            { label: "Campaign", value: (c) => <Link className="underline-offset-2 hover:underline" href={`/automation/campaigns/${c.id}`}>{c.name}</Link> },
            { label: "Sent", num: true, value: (c) => c.delivered.toLocaleString("en-GB") },
            { label: "Opened", num: true, value: (c) => `${c.opened.toLocaleString("en-GB")} (${formatValue(c.openRate, "percent")})` },
            { label: "Clicked", num: true, value: (c) => `${c.clicked.toLocaleString("en-GB")} (${formatValue(c.clickRate, "percent")})` },
          ]} />
        </Section>

        <Section title={SECTIONS[2][1]} gaps={gaps("engagement")} empty={isEmpty(report.engagement.kpis)} emptyAction={<Button variant="outline" size="sm" asChild><Link href={`/analytics/posts?${qs(query)}`}>Add post results</Link></Button>}>
          <Tiles kpis={report.engagement.kpis.slice(1)} days={days} />
          <SimpleTable caption="Post results" empty="No results yet." rows={report.engagement.posts.slice(0, 10)} columns={[
            { label: "Post", value: (p) => p.title },
            { label: "Channel", value: (p) => p.channel },
            { label: "Reach", num: true, value: (p) => (p.reach ?? "—").toLocaleString("en-GB") },
            { label: "Interactions", num: true, value: (p) => p.interactions.toLocaleString("en-GB") },
            { label: "Engagement", num: true, value: (p) => formatValue(p.rate, "percent") },
          ]} />
          <Button variant="outline" size="sm" asChild><Link href={`/analytics/posts?${qs(query)}`}>Add post results</Link></Button>
        </Section>

        <Section title={SECTIONS[3][1]} gaps={gaps("publishing")} empty={isEmpty(report.publishing.kpis)} emptyAction={<Button variant="outline" size="sm" asChild><Link href="/automation">Open the calendar</Link></Button>}>
          <Tiles kpis={report.publishing.kpis} days={days} />
          <SimpleTable caption="By channel" empty="Nothing scheduled in this period." rows={report.publishing.channels} columns={[
            { label: "Channel", value: (c) => c.channel },
            { label: "Scheduled", num: true, value: (c) => c.scheduled },
            { label: "Published", num: true, value: (c) => c.published },
            { label: "Failed", num: true, value: (c) => c.failed },
          ]} />
        </Section>

        <Section title={SECTIONS[4][1]} gaps={gaps("sales")} empty={isEmpty(report.sales.kpis) && !report.sales.outstanding.length} emptyAction={<Button variant="outline" size="sm" asChild><Link href="/stationery">Create an invoice or quote</Link></Button>}>
          <Tiles kpis={report.sales.kpis} days={days} />
          {(report.sales.paid.length > 0 || report.sales.outstanding.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="gap-1"><p className="text-sm text-muted-foreground">Paid in this period</p>{report.sales.paid.length ? report.sales.paid.map((x) => <p key={x.currency} className="text-xl font-semibold">{formatMoney(x.totalMinor, x.currency)} <span className="text-xs font-normal text-muted-foreground">previous {formatMoney(x.previousMinor, x.currency)}</span></p>) : <p className="text-sm">Nothing yet</p>}</Card>
              <Card className="gap-1"><p className="text-sm text-muted-foreground">Waiting to be paid (all time)</p>{report.sales.outstanding.length ? report.sales.outstanding.map((x) => <p key={x.currency} className="text-xl font-semibold">{formatMoney(x.totalMinor, x.currency)}</p>) : <p className="text-sm">Nothing outstanding</p>}</Card>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
