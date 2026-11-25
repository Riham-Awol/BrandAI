"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { switchWorkspaceAction } from "@/server/actions/workspace-actions.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const TYPE_LABELS = { PERSONAL: "Personal", TEAM: "Team", AGENCY: "Agency" };

function Status({ error, message }) {
  return (
    <>
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <p role="status" className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />{message}</p>}
    </>
  );
}

/** Workspace name, type, a new workspace, and (owner) deletion. */
export function WorkspaceSettings({ initial }) {
  const router = useRouter();
  const [ws, setWs] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [busy, setBusy] = useState(null);
  const [state, setState] = useState({});
  const [created, setCreated] = useState({ name: "", type: "TEAM" });
  const [confirmName, setConfirmName] = useState("");
  const base = `/api/v1/workspaces/${ws.id}`;

  async function run(key, fn) {
    setBusy(key);
    setState({});
    try {
      await fn();
    } catch (e) {
      setState({ [key]: { error: e.details?.name?.[0] ?? e.details?.confirmName?.[0] ?? e.message } });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <Card className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">This workspace</h2>
          <Badge>{TYPE_LABELS[ws.type]}</Badge>
          <Badge variant="secondary">{ws.planName} plan</Badge>
        </div>
        {ws.isClient && <p className="text-sm text-muted-foreground">A client workspace managed by <span className="font-medium text-foreground">{ws.agency?.name}</span>. Its plan and AI credits come from the agency.</p>}
        <p className="text-sm text-muted-foreground">Owner: {ws.owner.name} ({ws.owner.email}) · Created {new Date(ws.createdAt).toLocaleDateString()} · Your role: {ws.role.toLowerCase()}</p>
        <div className="grid gap-1.5 sm:max-w-sm">
          <Label htmlFor="ws-name">Name</Label>
          <Input id="ws-name" value={name} disabled={!ws.permissions.canRename} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <Status {...(state.rename ?? {})} />
        {ws.permissions.canRename && (
          <Button className="w-fit" disabled={busy !== null || name.trim() === ws.name} onClick={() => run("rename", async () => { setWs(await apiRequest(`${base}/settings`, { method: "PATCH", body: { name } })); setState({ rename: { message: "Saved." } }); router.refresh(); })}>
            {busy === "rename" && <Loader2 className="animate-spin" />} Save name
          </Button>
        )}
      </Card>

      <Card className="gap-4" id="new">
        <h2 className="flex items-center gap-2 font-semibold"><Plus className="size-4" /> New workspace</h2>
        <p className="text-sm text-muted-foreground">A team workspace for working with colleagues, or an agency workspace to manage clients (Agency plan).</p>
        <div role="radiogroup" aria-label="Workspace type" className="flex flex-wrap gap-2">
          {[["TEAM", "Team"], ["AGENCY", "Agency"]].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={created.type === k} onClick={() => setCreated((c) => ({ ...c, type: k }))} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", created.type === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>
              {k === "AGENCY" && <Building2 className="size-3.5" />}{l}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5 sm:max-w-sm"><Label htmlFor="ws-new">Workspace name</Label><Input id="ws-new" value={created.name} onChange={(e) => setCreated((c) => ({ ...c, name: e.target.value }))} maxLength={120} /></div>
        <Status {...(state.create ?? {})} />
        <Button className="w-fit" disabled={busy !== null || created.name.trim().length < 2} onClick={() => run("create", async () => { const w = await apiRequest("/api/v1/workspaces", { method: "POST", body: created }); await switchWorkspaceAction(w.id); router.push("/settings/workspace"); router.refresh(); })}>
          {busy === "create" && <Loader2 className="animate-spin" />} Create and switch
        </Button>
      </Card>

      {ws.permissions.canDelete && (
        <Card className="gap-3 border-destructive/40">
          <h2 className="flex items-center gap-2 font-semibold text-destructive"><Trash2 className="size-4" /> Delete workspace</h2>
          <p className="text-sm text-muted-foreground">Everyone loses access and a paid plan is cancelled. Type the workspace name to confirm.</p>
          <div className="grid gap-1.5 sm:max-w-sm"><Label htmlFor="ws-confirm">Workspace name</Label><Input id="ws-confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} /></div>
          <Status {...(state.del ?? {})} />
          <Button variant="destructive" className="w-fit" disabled={busy !== null || confirmName !== ws.name} onClick={() => run("del", async () => { await apiRequest(`${base}/settings`, { method: "DELETE", body: { confirmName } }); router.push("/dashboard"); router.refresh(); })}>
            {busy === "del" && <Loader2 className="animate-spin" />} Delete workspace
          </Button>
        </Card>
      )}
    </div>
  );
}
