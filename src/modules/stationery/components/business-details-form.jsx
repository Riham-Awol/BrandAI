"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES } from "../details.js";

const FIELDS = [
  ["Company", [["legalName", "Legal / trading name"], ["registrationNumber", "Company registration number"], ["taxNumber", "Tax / VAT number"]]],
  ["Address", [["addressLine1", "Address line 1"], ["addressLine2", "Address line 2"], ["city", "City"], ["postcode", "Postcode"], ["country", "Country"]]],
  ["Contact", [["email", "Email"], ["phone", "Phone"], ["website", "Website"]]],
];

export function BusinessDetailsForm({ workspaceId, businesses, businessId, initial, canEdit }) {
  const router = useRouter();
  const [form, setForm] = useState(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ""])));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const { saved: _s, updatedAt: _u, ...body } = form;
      const next = await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses/${businessId}/details`, { method: "PUT", body });
      setForm(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v ?? ""])));
      setMessage("Business details saved.");
    } catch (err) {
      setErrors(err.details ?? { _: [err.message] });
    } finally {
      setBusy(false);
    }
  }

  const input = (key, label, props = {}) => (
    <div key={key} className="grid gap-1.5">
      <Label htmlFor={`bd-${key}`}>{label}</Label>
      <Input id={`bd-${key}`} value={form[key]} onChange={(e) => set(key, e.target.value)} aria-invalid={Boolean(errors[key]) || undefined} {...props} />
      {errors[key] && <p className="text-xs font-medium text-destructive">{errors[key][0]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {businesses.length > 1 && (
        <div className="grid max-w-sm gap-1.5">
          <Label htmlFor="bd-business">Business</Label>
          <NativeSelect id="bd-business" value={businessId} onChange={(e) => router.push(`/stationery/details?business=${e.target.value}`)}>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect>
        </div>
      )}
      {errors._ && <Alert variant="destructive"><AlertCircle /><AlertDescription>{errors._[0]}</AlertDescription></Alert>}
      <fieldset disabled={!canEdit} className="grid gap-6 lg:grid-cols-2">
        {FIELDS.map(([title, fields]) => (
          <Card key={title} className="gap-4">
            <h2 className="font-semibold">{title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">{fields.map(([k, l]) => input(k, l))}</div>
          </Card>
        ))}
        <Card className="gap-4">
          <h2 className="font-semibold">Invoices &amp; quotations</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="bd-currency">Currency</Label>
              <NativeSelect id="bd-currency" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {[...new Set([form.currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}
              </NativeSelect>
            </div>
            {input("defaultTaxRate", "Default tax rate (%)", { type: "number", step: "0.01", min: 0, max: 100, inputMode: "decimal" })}
            {input("paymentTermsDays", "Payment terms (days)", { type: "number", min: 0, max: 365 })}
            <div />
            {input("invoicePrefix", "Invoice number prefix")}
            {input("nextInvoiceNumber", "Next invoice number", { type: "number", min: 1 })}
            {input("quotePrefix", "Quote number prefix")}
            {input("nextQuoteNumber", "Next quote number", { type: "number", min: 1 })}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bd-bank">Payment details (printed on invoices)</Label>
            <Textarea id="bd-bank" rows={3} value={form.bankDetails} onChange={(e) => set("bankDetails", e.target.value)} placeholder={"Account name: …\nSort code / IBAN: …"} />
            <p className="text-xs text-muted-foreground">Visible to everyone in this workspace and on invoices you share.</p>
          </div>
        </Card>
      </fieldset>
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Save details</Button>
          {message && <p role="status" className="text-sm text-success">{message}</p>}
        </div>
      )}
    </form>
  );
}
