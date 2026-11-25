"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { AlertCircle, CheckCircle2, Copy, Download, KeyRound, Loader2, LogOut, MailCheck, ShieldCheck, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function useAction() {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  async function run(key, fn) {
    setBusy(key);
    setError(null);
    setErrors({});
    setMessage(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      setErrors(e.details ?? {});
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, errors, message, setMessage, run };
}

function Feedback({ a }) {
  return (
    <>
      {a.error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{a.error}</AlertDescription></Alert>}
      {a.message && <p role="status" className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />{a.message}</p>}
    </>
  );
}

const FieldError = ({ msg }) => (msg ? <p className="text-xs font-medium text-destructive">{msg}</p> : null);

function RecoveryCodes({ codes }) {
  const text = codes.join("\n");
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="text-sm font-medium">Save these recovery codes somewhere safe. Each one works once if you lose your phone. They won&apos;t be shown again.</p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm" aria-label="Recovery codes">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(text)}><Copy /> Copy</Button>
        <Button size="sm" variant="outline" asChild><a download="brand-ai-recovery-codes.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Brand AI recovery codes\n\n${text}\n`)}`}><Download /> Download</a></Button>
      </div>
    </div>
  );
}

/** Account & security: profile, email, password, two-factor, sessions, deletion. */
export function AccountSettings({ initial }) {
  const [account, setAccount] = useState(initial);
  const profile = useAction();
  const email = useAction();
  const pw = useAction();
  const mfa = useAction();
  const sessions = useAction();
  const danger = useAction();
  const [name, setName] = useState(initial.name);
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "" });
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [disable, setDisable] = useState({ password: "", code: "" });
  const [codes, setCodes] = useState(null);
  const [del, setDel] = useState({ password: "", confirm: "" });

  return (
    <div className="grid max-w-3xl gap-6">
      <Card className="gap-4">
        <h2 className="font-semibold">Profile</h2>
        <div className="grid gap-1.5 sm:max-w-sm">
          <Label htmlFor="acc-name">Name</Label>
          <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={Boolean(profile.errors.name) || undefined} />
          <FieldError msg={profile.errors.name?.[0]} />
        </div>
        <Feedback a={profile} />
        <Button className="w-fit" disabled={profile.busy !== null || name.trim() === account.name} onClick={() => profile.run("save", async () => { setAccount(await apiRequest("/api/v1/me/account", { method: "PATCH", body: { name } })); profile.setMessage("Saved."); })}>
          {profile.busy && <Loader2 className="animate-spin" />} Save profile
        </Button>
      </Card>

      <Card className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Email</h2>
          {account.emailVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Not verified</Badge>}
        </div>
        <p className="text-sm">{account.email}</p>
        {!account.emailVerified && (
          <>
            <p className="text-sm text-muted-foreground">Confirm your address so we can reach you about security and billing.</p>
            <Feedback a={email} />
            <Button variant="outline" className="w-fit" disabled={email.busy !== null} onClick={() => email.run("send", async () => { await apiRequest("/api/v1/me/email-verification", { method: "POST" }); email.setMessage("Check your inbox for the confirmation link."); })}>
              {email.busy ? <Loader2 className="animate-spin" /> : <MailCheck />} Send confirmation email
            </Button>
          </>
        )}
      </Card>

      <Card className="gap-4">
        <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="size-4" /> Password</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="pw-current">Current password</Label><Input id="pw-current" type="password" autoComplete="current-password" value={pwForm.currentPassword} onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))} /><FieldError msg={pw.errors.currentPassword?.[0]} /></div>
          <div className="grid gap-1.5"><Label htmlFor="pw-new">New password</Label><Input id="pw-new" type="password" autoComplete="new-password" value={pwForm.newPassword} onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))} /><FieldError msg={pw.errors.newPassword?.[0]} /></div>
        </div>
        <p className="text-xs text-muted-foreground">At least 10 characters with a number or symbol. Changing it signs you out everywhere.</p>
        <Feedback a={pw} />
        <Button className="w-fit" disabled={pw.busy !== null || !pwForm.currentPassword || !pwForm.newPassword} onClick={() => pw.run("pw", async () => { await apiRequest("/api/v1/me/password", { method: "POST", body: pwForm }); await signOut({ callbackUrl: "/login?signedout=1" }); })}>
          {pw.busy && <Loader2 className="animate-spin" />} Change password
        </Button>
      </Card>

      <Card className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> Two-factor sign-in</h2>
          {account.mfaEnabled ? <Badge variant="success">On</Badge> : <Badge>Off</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">Ask for a code from an authenticator app (Google Authenticator, 1Password, Authy…) after your password.</p>
        {!account.mfaAvailable && !account.mfaEnabled && <p className="text-sm text-muted-foreground">Not available on this server yet (the administrator needs to set an encryption key).</p>}
        {codes && <RecoveryCodes codes={codes} />}
        <Feedback a={mfa} />
        {!account.mfaEnabled && account.mfaAvailable && !setup && (
          <Button className="w-fit" disabled={mfa.busy !== null} onClick={() => mfa.run("start", async () => setSetup(await apiRequest("/api/v1/me/mfa/setup", { method: "POST" })))}>
            {mfa.busy && <Loader2 className="animate-spin" />} Set up two-factor sign-in
          </Button>
        )}
        {!account.mfaEnabled && setup && (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element -- server-generated QR code */}
            <img src={setup.qrCode} alt="QR code for your authenticator app" width={180} height={180} className="rounded-lg border bg-white p-2" />
            <div className="grid content-start gap-3">
              <p className="text-sm">1. Scan the QR code with your authenticator app, or enter this key:</p>
              <code className="w-fit break-all rounded bg-muted px-2 py-1 text-sm" data-testid="mfa-secret">{setup.secret}</code>
              <div className="grid gap-1.5 sm:max-w-xs">
                <Label htmlFor="mfa-code">2. Enter the 6-digit code it shows</Label>
                <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
                <FieldError msg={mfa.errors.code?.[0]} />
              </div>
              <Button className="w-fit" disabled={mfa.busy !== null || code.trim().length < 6} onClick={() => mfa.run("enable", async () => { const r = await apiRequest("/api/v1/me/mfa/enable", { method: "POST", body: { code } }); setCodes(r.recoveryCodes); setSetup(null); setCode(""); setAccount((a) => ({ ...a, mfaEnabled: true, recoveryCodesLeft: r.recoveryCodes.length })); mfa.setMessage("Two-factor sign-in is on."); })}>
                {mfa.busy && <Loader2 className="animate-spin" />} Turn on
              </Button>
            </div>
          </div>
        )}
        {account.mfaEnabled && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{account.recoveryCodesLeft} recovery codes left.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="mfa-off-pw">Password</Label><Input id="mfa-off-pw" type="password" autoComplete="current-password" value={disable.password} onChange={(e) => setDisable((d) => ({ ...d, password: e.target.value }))} /><FieldError msg={mfa.errors.password?.[0]} /></div>
              <div className="grid gap-1.5"><Label htmlFor="mfa-off-code">Code from your app</Label><Input id="mfa-off-code" autoComplete="one-time-code" value={disable.code} onChange={(e) => setDisable((d) => ({ ...d, code: e.target.value }))} /><FieldError msg={mfa.errors.code?.[0]} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={mfa.busy !== null || disable.code.length < 6} onClick={() => mfa.run("regen", async () => { const r = await apiRequest("/api/v1/me/mfa/recovery-codes", { method: "POST", body: { code: disable.code } }); setCodes(r.recoveryCodes); setAccount((a) => ({ ...a, recoveryCodesLeft: r.recoveryCodes.length })); setDisable({ password: "", code: "" }); })}>New recovery codes</Button>
              <Button variant="destructive" disabled={mfa.busy !== null || !disable.password || disable.code.length < 6} onClick={() => mfa.run("off", async () => { await apiRequest("/api/v1/me/mfa/disable", { method: "POST", body: disable }); setAccount((a) => ({ ...a, mfaEnabled: false, recoveryCodesLeft: 0 })); setCodes(null); setDisable({ password: "", code: "" }); mfa.setMessage("Two-factor sign-in is off."); })}>Turn off</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><LogOut className="size-4" /> Sessions</h2>
        <p className="text-sm text-muted-foreground">Lost a device or signed in on a shared computer? Sign out of Brand AI everywhere, including here.{account.lastLoginAt ? ` Last sign-in: ${new Date(account.lastLoginAt).toLocaleString()}.` : ""}</p>
        <Feedback a={sessions} />
        <Button variant="outline" className="w-fit" disabled={sessions.busy !== null} onClick={() => sessions.run("all", async () => { await apiRequest("/api/v1/me/sessions/revoke", { method: "POST" }); await signOut({ callbackUrl: "/login?signedout=1" }); })}>
          {sessions.busy && <Loader2 className="animate-spin" />} Sign out everywhere
        </Button>
      </Card>

      <Card className="gap-3 border-destructive/40">
        <h2 className="flex items-center gap-2 font-semibold text-destructive"><Trash2 className="size-4" /> Delete account</h2>
        <p className="text-sm text-muted-foreground">Closes your account and deletes the workspaces you own (paid plans are cancelled). If you own a workspace with other members, transfer it first.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="del-pw">Password</Label><Input id="del-pw" type="password" autoComplete="current-password" value={del.password} onChange={(e) => setDel((d) => ({ ...d, password: e.target.value }))} /><FieldError msg={danger.errors.password?.[0]} /></div>
          <div className="grid gap-1.5"><Label htmlFor="del-confirm">Type DELETE to confirm</Label><Input id="del-confirm" value={del.confirm} onChange={(e) => setDel((d) => ({ ...d, confirm: e.target.value }))} /></div>
        </div>
        <Feedback a={danger} />
        <Button variant="destructive" className="w-fit" disabled={danger.busy !== null || del.confirm !== "DELETE" || !del.password} onClick={() => danger.run("del", async () => { await apiRequest("/api/v1/me/delete", { method: "POST", body: del }); await signOut({ callbackUrl: "/login" }); })}>
          {danger.busy && <Loader2 className="animate-spin" />} Delete my account
        </Button>
      </Card>
    </div>
  );
}
