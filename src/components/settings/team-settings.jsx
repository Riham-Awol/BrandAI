"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, LogOut, Mail, ShieldCheck, UserPlus, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const ROLES = { OWNER: "Owner", ADMIN: "Admin", EDITOR: "Editor", VIEWER: "Viewer" };
const ROLE_HELP = [
  ["Owner", "Everything, including billing, ownership and deleting the workspace."],
  ["Admin", "Manage the team (except admins), approve and publish, settings and integrations."],
  ["Editor", "Create businesses, use AI and studios, schedule content."],
  ["Viewer", "See everything, change nothing."],
];

/** Members, invitations, roles, leaving and ownership transfer. */
export function TeamSettings({ workspaceId, workspaceType, initial }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [form, setForm] = useState({ email: "", role: "EDITOR" });
  const [transfer, setTransfer] = useState({ memberId: "", password: "" });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const base = `/api/v1/workspaces/${workspaceId}`;
  const p = data.permissions;
  const reload = async () => setData(await apiRequest(`${base}/members`));

  async function run(key, fn, done) {
    setBusy(key);
    setError(null);
    setErrors({});
    setMessage(null);
    try {
      await fn();
      if (done) setMessage(done);
    } catch (e) {
      setError(e.message);
      setErrors(e.details ?? {});
    } finally {
      setBusy(null);
    }
  }

  const you = data.members.find((m) => m.isYou);
  return (
    <div className="grid gap-6">
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <p role="status" className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />{message}</p>}

      {p.canManage && workspaceType !== "PERSONAL" && (
        <Card className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><UserPlus className="size-4" /> Invite someone</h2>
            <span className="text-sm text-muted-foreground">{data.seats.used} of {data.seats.limit} seats used ({data.seats.plan} plan)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <div className="grid gap-1.5"><Label htmlFor="inv-email">Email</Label><Input id="inv-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} aria-invalid={Boolean(errors.email) || undefined} />{errors.email && <p className="text-xs font-medium text-destructive">{errors.email[0]}</p>}</div>
            <div className="grid gap-1.5"><Label htmlFor="inv-role">Role</Label><NativeSelect id="inv-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>{(p.canManageAdmins ? ["ADMIN", "EDITOR", "VIEWER"] : ["EDITOR", "VIEWER"]).map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}</NativeSelect></div>
            <Button disabled={busy !== null || !form.email} onClick={() => run("invite", async () => { await apiRequest(`${base}/invitations`, { method: "POST", body: form }); setForm({ email: "", role: form.role }); await reload(); }, "Invitation sent.")}>{busy === "invite" ? <Loader2 className="animate-spin" /> : <Mail />} Send invite</Button>
          </div>
        </Card>
      )}
      {workspaceType === "PERSONAL" && <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">This is your personal workspace. To work with others, create a team workspace in Settings → Workspace.</p>}

      <Card className="gap-3 overflow-x-auto">
        <h2 className="font-semibold">Members</h2>
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Members</caption>
          <thead className="text-left text-muted-foreground"><tr><th scope="col" className="py-2 font-medium">Name</th><th scope="col" className="py-2 font-medium">Role</th><th scope="col" className="py-2 font-medium">Joined</th><th scope="col" className="py-2"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y">
            {data.members.map((m) => {
              const editable = p.canManage && !m.isYou && m.role !== "OWNER" && (m.role !== "ADMIN" || p.canManageAdmins);
              return (
                <tr key={m.id}>
                  <td className="py-2"><span className="font-medium">{m.name}</span>{m.isYou && <span className="text-muted-foreground"> (you)</span>}<span className="block text-xs text-muted-foreground">{m.email}{m.mfaEnabled && <span className="ml-1 inline-flex items-center gap-0.5"><ShieldCheck className="size-3" aria-hidden="true" /> 2FA</span>}</span></td>
                  <td className="py-2">
                    {editable ? (
                      <NativeSelect aria-label={`Role for ${m.name}`} className="h-9 w-32" value={m.role} disabled={busy !== null} onChange={(e) => run(`r-${m.id}`, async () => { await apiRequest(`${base}/members/${m.id}`, { method: "PATCH", body: { role: e.target.value } }); await reload(); }, "Role updated.")}>
                        {(p.canManageAdmins ? ["ADMIN", "EDITOR", "VIEWER"] : ["EDITOR", "VIEWER"]).map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
                      </NativeSelect>
                    ) : <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>{ROLES[m.role]}</Badge>}
                  </td>
                  <td className="py-2 text-muted-foreground">{new Date(m.joinedAt).toLocaleDateString()}</td>
                  <td className="py-2 text-right">{editable && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => run(`x-${m.id}`, async () => { await apiRequest(`${base}/members/${m.id}`, { method: "DELETE" }); await reload(); }, `${m.name} was removed.`)}>Remove</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.invitations.length > 0 && (
          <>
            <h3 className="pt-2 text-sm font-semibold">Pending invitations</h3>
            <ul className="divide-y text-sm">
              {data.invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{i.email} · {ROLES[i.role]} <span className="text-muted-foreground">· expires {new Date(i.expiresAt).toLocaleDateString()}</span></span>
                  <Button size="sm" variant="ghost" aria-label={`Cancel invitation for ${i.email}`} disabled={busy !== null} onClick={() => run(`v-${i.id}`, async () => { await apiRequest(`${base}/invitations/${i.id}`, { method: "DELETE" }); await reload(); }, "Invitation cancelled.")}><X /> Cancel</Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card className="gap-2">
        <h2 className="font-semibold">What each role can do</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">{ROLE_HELP.map(([r, d]) => <div key={r}><dt className="font-medium">{r}</dt><dd className="text-muted-foreground">{d}</dd></div>)}</dl>
      </Card>

      {p.canTransfer && data.members.length > 1 && (
        <Card className="gap-3">
          <h2 className="font-semibold">Transfer ownership</h2>
          <p className="text-sm text-muted-foreground">The new owner gets billing and deletion rights; you become an admin.</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5"><Label htmlFor="tr-member">New owner</Label><NativeSelect id="tr-member" value={transfer.memberId} onChange={(e) => setTransfer((t) => ({ ...t, memberId: e.target.value }))}><option value="">Choose a member…</option>{data.members.filter((m) => !m.isYou).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect></div>
            <div className="grid gap-1.5"><Label htmlFor="tr-pw">Your password</Label><Input id="tr-pw" type="password" autoComplete="current-password" value={transfer.password} onChange={(e) => setTransfer((t) => ({ ...t, password: e.target.value }))} /></div>
            <Button variant="outline" disabled={busy !== null || !transfer.memberId || !transfer.password} onClick={() => run("tr", async () => { await apiRequest(`${base}/transfer`, { method: "POST", body: transfer }); setTransfer({ memberId: "", password: "" }); await reload(); router.refresh(); }, "Ownership transferred.")}>Transfer</Button>
          </div>
        </Card>
      )}

      {you && you.role !== "OWNER" && (
        <Button variant="outline" className="w-fit" disabled={busy !== null} onClick={() => run("leave", async () => { await apiRequest(`${base}/leave`, { method: "POST" }); router.push("/dashboard"); router.refresh(); })}><LogOut /> Leave this workspace</Button>
      )}
    </div>
  );
}
