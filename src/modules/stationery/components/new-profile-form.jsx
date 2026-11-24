"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, BookOpen, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const NEW = "__new__";

export function NewProfileForm({ workspaceId, businesses }) {
  const router = useRouter();
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? NEW);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  return (
    <Card className="max-w-2xl gap-5">
      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-1.5">
        <Label htmlFor="p-business">Business</Label>
        <NativeSelect id="p-business" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
          {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          <option value={NEW}>+ A new business</option>
        </NativeSelect>
      </div>
      {businessId === NEW && <div className="grid gap-1.5"><Label htmlFor="p-name">Business name</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></div>}
      <div className="grid gap-1.5">
        <Label htmlFor="p-purpose">Who is it for? (optional)</Label>
        <Textarea id="p-purpose" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={500} placeholder="e.g. For cafés and restaurants considering us as their bread supplier" />
      </div>
      <Button
        className="w-fit"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            let bid = businessId;
            if (bid === NEW) {
              if (!name.trim()) throw new Error("Enter the business name.");
              bid = (await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses`, { method: "POST", body: { name: name.trim(), stage: "STARTING" } })).id;
            }
            const p = await apiRequest(`/api/v1/workspaces/${workspaceId}/company-profiles`, { method: "POST", body: { businessId: bid, purpose } });
            router.push(`/stationery/profiles/${p.id}`);
          } catch (e) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <BookOpen />} Start company profile
      </Button>
    </Card>
  );
}
