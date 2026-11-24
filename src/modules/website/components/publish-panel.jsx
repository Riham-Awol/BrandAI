"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Globe, Loader2, PowerOff, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DOMAIN_STATUS = { PENDING: ["secondary", "Waiting for DNS"], VERIFIED: ["success", "Connected"], FAILED: ["warning", "Not found yet"] };

export function PublishPanel({ website, base, onChanged, dirty, onDeleted }) {
  const { canPublish } = website.permissions;
  const [versions, setVersions] = useState(null);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest(`${base}/publish`)
      .then((v) => !cancelled && setVersions(v))
      .catch(() => !cancelled && setVersions([]));
    return () => {
      cancelled = true;
    };
  }, [base, website.publishedVersion]);

  async function run(key, fn) {
    setBusy(key);
    setError(null);
    setFieldError(null);
    try {
      const next = await fn();
      if (next) onChanged(next);
    } catch (e) {
      if (e.details?.domain) setFieldError(e.details.domain[0]);
      else setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const live = website.status === "PUBLISHED";
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="gap-5">
        <h2 className="flex items-center gap-2 font-semibold"><Globe className="size-4" /> Publishing</h2>
        {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
        {live ? (
          <div className="space-y-2">
            <p className="text-sm">Your website is <strong>live</strong> (version {website.publishedVersion}).</p>
            <div className="flex flex-wrap items-center gap-2">
              <a href={website.urls.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-sm text-highlight underline underline-offset-4">{origin}{website.urls.path} <ExternalLink className="size-3.5 shrink-0" /></a>
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(`${origin}${website.urls.path}`)} aria-label="Copy link"><Copy /></Button>
            </div>
            {website.urls.domainUrl && <p className="text-sm">Also at <a className="text-highlight underline" href={website.urls.domainUrl} target="_blank" rel="noopener noreferrer">{website.urls.domainUrl}</a></p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{website.status === "UNPUBLISHED" ? "The website is offline. Publish to bring it back." : "Not published yet. Publish to put the website online."}</p>
        )}
        {(dirty || website.hasUnpublishedChanges) && live && <p className="text-sm text-warning">You have changes that are not live yet. Use “Publish” at the top to update the site.</p>}
        {!canPublish && <p className="text-sm text-muted-foreground">Only owners and admins can publish or take the site offline.</p>}
        {canPublish && live && (
          <Button variant="outline" className="w-fit" disabled={busy !== null} onClick={() => run("unpublish", () => apiRequest(`${base}/unpublish`, { method: "POST" }))}>
            {busy === "unpublish" ? <Loader2 className="animate-spin" /> : <PowerOff />} Take offline
          </Button>
        )}
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-medium">Published versions</h3>
          {versions === null ? <p className="text-sm text-muted-foreground">Loading…</p> : versions.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
            <ul className="divide-y text-sm">
              {versions.map((v) => (
                <li key={v.version} className="flex items-center justify-between gap-2 py-2">
                  <span>Version {v.version} <span className="text-muted-foreground">· {new Date(v.publishedAt).toLocaleString()}</span></span>
                  {v.version === website.publishedVersion && live ? <Badge variant="success">Live</Badge> : website.permissions.canEdit && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(`restore-${v.version}`, () => apiRequest(`${base}/versions/${v.version}`, { method: "POST" }))}>
                      <RotateCcw /> Copy to draft
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {canPublish && (
          <div className="border-t pt-4">
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete website</Button>
          </div>
        )}
      </Card>

      <Card className="gap-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> Custom domain</h2>
        {website.domain ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{website.domain.domain}</span>
              <Badge variant={DOMAIN_STATUS[website.domain.status][0]}>{DOMAIN_STATUS[website.domain.status][1]}</Badge>
            </div>
            {website.domain.status !== "VERIFIED" && (
              <>
                <p className="text-sm text-muted-foreground">Add these two records at your domain provider (where you bought the domain), then press “Check DNS”. Changes can take up to a few hours.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3 font-medium">Type</th><th className="py-1 pr-3 font-medium">Name / host</th><th className="py-1 font-medium">Value</th></tr></thead>
                    <tbody className="divide-y">
                      {website.domain.records.map((r) => (
                        <tr key={r.type}><td className="py-2 pr-3 font-medium">{r.type}</td><td className="break-all py-2 pr-3 font-mono text-xs">{r.name}</td><td className="break-all py-2 font-mono text-xs">{r.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {website.domain.status === "FAILED" && <p className="text-sm text-warning">We couldn&apos;t find the TXT record yet{website.domain.checkedAt ? ` (checked ${new Date(website.domain.checkedAt).toLocaleTimeString()})` : ""}. DNS changes can take a while — try again later.</p>}
              </>
            )}
            {website.domain.status === "VERIFIED" && (
              <Alert variant="success"><CheckCircle2 /><AlertTitle>Domain verified</AlertTitle><AlertDescription>Visitors to {website.domain.domain} see your published website. HTTPS certificates are issued by your hosting (see the deployment guide).</AlertDescription></Alert>
            )}
            {canPublish && (
              <div className="flex flex-wrap gap-2">
                {website.domain.status !== "VERIFIED" && (
                  <Button disabled={busy !== null} onClick={() => run("verify", () => apiRequest(`${base}/domain/verify`, { method: "POST" }))}>{busy === "verify" ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Check DNS</Button>
                )}
                <Button variant="outline" disabled={busy !== null} onClick={() => run("remove", () => apiRequest(`${base}/domain`, { method: "DELETE" }))}>Remove domain</Button>
              </div>
            )}
          </div>
        ) : canPublish ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run("domain", () => apiRequest(`${base}/domain`, { method: "PUT", body: { domain } }));
            }}
          >
            <p className="text-sm text-muted-foreground">Use a domain you own, like <span className="font-mono">www.yourbusiness.com</span>. Brand AI shows you the DNS records to add.</p>
            <div className="grid gap-1.5">
              <Label htmlFor="w-domain">Domain</Label>
              <Input id="w-domain" value={domain} onChange={(e) => setDomain(e.target.value.trim().toLowerCase())} placeholder="www.example.com" aria-invalid={Boolean(fieldError) || undefined} />
              {fieldError && <p className="text-xs font-medium text-destructive">{fieldError}</p>}
            </div>
            <Button type="submit" disabled={!domain || busy !== null}>{busy === "domain" && <Loader2 className="animate-spin" />} Connect domain</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Only owners and admins can connect domains.</p>
        )}
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this website?</DialogTitle>
            <DialogDescription>It goes offline immediately, its address and domain are released, and it disappears from your list.</DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy !== null} onClick={async () => {
              setBusy("delete");
              try {
                await apiRequest(base, { method: "DELETE" });
                onDeleted();
              } catch (e) {
                setError(e.message);
                setBusy(null);
                setConfirmDelete(false);
              }
            }}>{busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
