"use client";

import { useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AdminUsers({ initial }) {
  const [users, setUsers] = useState(initial);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const search = async (query = q) => setUsers(await apiRequest(`/api/v1/admin/users?q=${encodeURIComponent(query)}`));

  async function toggle(u) {
    const reason = u.suspended ? undefined : window.prompt(`Reason for suspending ${u.email} (saved in the audit log):`) ?? null;
    if (reason === null) return;
    setBusy(u.id);
    setError(null);
    try {
      await apiRequest(`/api/v1/admin/users/${u.id}`, { method: "PATCH", body: { suspended: !u.suspended, reason: reason || undefined } });
      await search();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <Input aria-label="Search users" placeholder="Email or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="outline"><Search /> Search</Button>
      </form>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      <Card className="gap-0 overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Users</caption>
          <thead className="text-left text-muted-foreground"><tr><th scope="col" className="px-4 py-2 font-medium">Account</th><th scope="col" className="px-4 py-2 font-medium">Security</th><th scope="col" className="px-4 py-2 font-medium">Workspaces</th><th scope="col" className="px-4 py-2 font-medium">Joined · last sign-in</th><th scope="col" className="px-4 py-2"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2"><span className="font-medium">{u.name}</span> {u.isPlatformAdmin && <Badge>Admin</Badge>} {u.suspended && <Badge variant="warning">Suspended</Badge>}<span className="block text-xs text-muted-foreground">{u.email}</span></td>
                <td className="px-4 py-2 text-xs">{u.emailVerified ? "Email verified" : "Email not verified"} · {u.mfaEnabled ? "2FA on" : "2FA off"}</td>
                <td className="px-4 py-2">{u.workspaces}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()} · {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "never"}</td>
                <td className="px-4 py-2 text-right">{!u.isPlatformAdmin && <Button size="sm" variant={u.suspended ? "outline" : "ghost"} disabled={busy !== null} onClick={() => toggle(u)}>{u.suspended ? "Restore" : "Suspend"}</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No matching accounts.</p>}
      </Card>
    </div>
  );
}
