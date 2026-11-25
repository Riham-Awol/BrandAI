"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, PauseCircle, PlayCircle, Zap } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const yes = (v) => (v ? <Badge variant="success">Configured</Badge> : <Badge variant="secondary">Not configured</Badge>);

export function AdminAi({ initial, signupsOpen: initialSignups }) {
  const [ai, setAi] = useState(initial);
  const [signups, setSignups] = useState(initialSignups);
  const [message, setMessage] = useState(initial.pausedMessage ?? "");
  const [test, setTest] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function run(key, fn) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid max-w-4xl gap-6">
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      <Card className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">AI generation</h2>
          {ai.paused ? <Badge variant="warning">Paused</Badge> : <Badge variant="success">Running</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">Primary provider <span className="font-medium text-foreground">{ai.primary}</span>{ai.model ? ` (${ai.model})` : ""}{ai.fallbacks.length ? `, falling back to ${ai.fallbacks.join(", ")}` : ""}.{ai.mockAllowed ? " Mock AI is allowed on this server (test mode)." : ""}</p>
        <div className="grid gap-1.5 sm:max-w-lg"><Label htmlFor="ai-msg">Message shown while paused</Label><Input id="ai-msg" value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} placeholder="AI features are paused for maintenance." /></div>
        <div className="flex flex-wrap gap-2">
          <Button variant={ai.paused ? "default" : "destructive"} disabled={busy !== null} onClick={() => run("pause", async () => { await apiRequest("/api/v1/admin/ai/pause", { method: "PUT", body: { paused: !ai.paused, message } }); setAi(await apiRequest("/api/v1/admin/ai")); })}>
            {ai.paused ? <PlayCircle /> : <PauseCircle />} {ai.paused ? "Resume AI" : "Pause all AI"}
          </Button>
          <Button variant="outline" disabled={busy !== null || ai.paused} onClick={() => run("test", async () => setTest(await apiRequest("/api/v1/admin/ai/test", { method: "POST" })))}>{busy === "test" ? <Loader2 className="animate-spin" /> : <Zap />} Send a test request</Button>
        </div>
        {test && <p role="status" className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />{test.provider} / {test.model} answered “{test.reply}” in {(test.ms / 1000).toFixed(1)} s{test.isMock ? " (mock)" : ""}.</p>}
      </Card>

      <Card className="gap-3 overflow-x-auto">
        <h2 className="font-semibold">Providers</h2>
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">AI providers</caption>
          <thead className="text-left text-muted-foreground"><tr><th scope="col" className="py-2 font-medium">Provider</th><th scope="col" className="py-2 font-medium">Default model</th><th scope="col" className="py-2 font-medium">API key</th></tr></thead>
          <tbody className="divide-y">{ai.providers.map((p) => <tr key={p.key}><td className="py-2">{p.label}{(p.key === ai.primary || ai.fallbacks.includes(p.key)) && <Badge className="ml-2">{p.key === ai.primary ? "primary" : "fallback"}</Badge>}</td><td className="py-2 font-mono text-xs">{p.defaultModel}</td><td className="py-2">{yes(p.keyConfigured)}</td></tr>)}</tbody>
        </table>
        <h3 className="pt-2 text-sm font-semibold">Last 7 days</h3>
        {ai.health.length === 0 ? <p className="text-sm text-muted-foreground">No AI requests yet.</p> : (
          <table className="w-full min-w-[480px] text-sm">
            <caption className="sr-only">Provider health</caption>
            <thead className="text-left text-muted-foreground"><tr><th scope="col" className="py-2 font-medium">Provider</th><th scope="col" className="py-2 text-right font-medium">Succeeded</th><th scope="col" className="py-2 text-right font-medium">Failed</th><th scope="col" className="py-2 text-right font-medium">Avg time</th></tr></thead>
            <tbody className="divide-y tabular-nums">{ai.health.map((h) => <tr key={h.provider}><td className="py-2">{h.provider}</td><td className="py-2 text-right">{h.succeeded}</td><td className="py-2 text-right">{h.failed}</td><td className="py-2 text-right">{h.avgLatencyMs == null ? "—" : `${(h.avgLatencyMs / 1000).toFixed(1)} s`}</td></tr>)}</tbody>
          </table>
        )}
        <p className="text-xs text-muted-foreground">Keys are read from the server environment and never shown. Change providers with AI_TEXT_PROVIDER / AI_TEXT_FALLBACK_PROVIDERS and redeploy.</p>
      </Card>

      <Card className="gap-3">
        <h2 className="font-semibold">Services and sign-ups</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Payments (Stripe)</dt><dd>{yes(ai.services.payments)}</dd></div>
          <div><dt className="text-muted-foreground">Email provider</dt><dd>{ai.services.email}{ai.services.email === "console" ? " (development: not delivered)" : ""}</dd></div>
          <div><dt className="text-muted-foreground">Credential encryption</dt><dd>{yes(ai.services.encryption)}</dd></div>
          <div><dt className="text-muted-foreground">Scheduler (CRON_SECRET)</dt><dd>{yes(ai.services.scheduler)}</dd></div>
          <div><dt className="text-muted-foreground">File storage</dt><dd>{ai.services.storage}</dd></div>
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">New sign-ups are <span className="font-semibold">{signups ? "open" : "closed (invitations only)"}</span>.</p>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run("signups", async () => { await apiRequest("/api/v1/admin/signups", { method: "PUT", body: { open: !signups } }); setSignups(!signups); })}>{signups ? "Close sign-ups" : "Open sign-ups"}</Button>
        </div>
      </Card>
    </div>
  );
}
