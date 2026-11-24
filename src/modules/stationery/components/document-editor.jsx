"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Copy, FileText, Info, Loader2, Plus, Printer, Save, Sparkles, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { flattenZodError } from "@/validation/common.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES } from "../details.js";
import { DOCUMENT_TYPES, STATUS_LABELS, documentInputSchema } from "../documents.js";
import { computeTotals, formatMoney, taxBreakdown } from "../money.js";

const NEW = "__new__";
const STATUS_VARIANT = { DRAFT: "secondary", SENT: "default", PAID: "success", ACCEPTED: "success", DECLINED: "warning", VOID: "warning" };
const ACTION_LABELS = { SENT: "Mark as sent", PAID: "Mark as paid", ACCEPTED: "Mark accepted", DECLINED: "Mark declined", VOID: "Void", DRAFT: "Back to draft" };

const emptyLine = (taxRate) => ({ description: "", quantity: "1", unitPrice: "", taxRate });

function toForm(doc) {
  return {
    customer: { name: doc.customer.name ?? "", company: doc.customer.company ?? "", email: doc.customer.email ?? "", address: doc.customer.address ?? "", taxNumber: doc.customer.taxNumber ?? "" },
    issueDate: doc.issueDate, dueDate: doc.dueDate ?? "", currency: doc.currency,
    lines: doc.lines.map(({ description, quantity, unitPrice, taxRate }) => ({ description, quantity, unitPrice, taxRate })),
    intro: doc.intro ?? "", notes: doc.notes ?? "", terms: doc.terms ?? "",
  };
}

export function DocumentEditor({ workspaceId, type, businesses, defaultBusinessId, initialDocument, ai }) {
  const router = useRouter();
  const isNew = !initialDocument;
  const [doc, setDoc] = useState(initialDocument);
  const [businessId, setBusinessId] = useState(initialDocument?.businessId ?? defaultBusinessId ?? businesses?.[0]?.id ?? NEW);
  const [newBusinessName, setNewBusinessName] = useState("");
  const [form, setForm] = useState(() => (initialDocument ? toForm(initialDocument) : { customer: { name: "", company: "", email: "", address: "", taxNumber: "" }, issueDate: new Date().toISOString().slice(0, 10), dueDate: "", currency: "GBP", lines: [emptyLine(0)], intro: "", notes: "", terms: "" }));
  const [defaults, setDefaults] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [brief, setBrief] = useState("");
  // Once the user edits any tax rate, defaults loaded later no longer overwrite it.
  const taxTouched = useRef(false);
  const docType = doc?.type ?? type;
  const editable = isNew || (doc.status === "DRAFT" && doc.permissions.canEdit);
  const base = `/api/v1/workspaces/${workspaceId}/documents`;

  // New documents take currency, tax rate and dates from the business details.
  useEffect(() => {
    if (!isNew || businessId === NEW) return;
    let cancelled = false;
    apiRequest(`${base}/defaults?businessId=${businessId}&type=${type}`).then((d) => {
      if (cancelled) return;
      setDefaults(d);
      setForm((f) => ({ ...f, currency: d.currency, issueDate: d.issueDate, dueDate: d.dueDate, lines: taxTouched.current ? f.lines : f.lines.map((l) => ({ ...l, taxRate: d.taxRate })) }));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isNew, businessId, base, type]);

  const totals = useMemo(() => {
    try {
      const t = computeTotals(form.lines.map((l) => ({ ...l, unitPrice: l.unitPrice || "0", quantity: l.quantity || "0" })), form.currency);
      return { ...t, taxes: taxBreakdown(t.lines) };
    } catch {
      return null;
    }
  }, [form.lines, form.currency]);
  const money = (m) => formatMoney(m, form.currency);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCustomer = (k, v) => setForm((f) => ({ ...f, customer: { ...f.customer, [k]: v } }));
  const setLine = (i, k, v) => setForm((f) => ({ ...f, lines: f.lines.map((l, n) => (n === i ? { ...l, [k]: v } : l)) }));
  const err = (path) => errors[path]?.[0];

  async function run(key, fn) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
      if (e.details) setErrors(e.details);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    let bid = businessId;
    const body = { ...form, businessId: bid === NEW ? "00000000-0000-4000-8000-000000000000" : bid, type: docType };
    const check = documentInputSchema.safeParse(body);
    if (!check.success) {
      setErrors(flattenZodError(check.error));
      setError("Some fields need attention.");
      return;
    }
    setErrors({});
    await run("save", async () => {
      if (isNew) {
        if (bid === NEW) {
          if (!newBusinessName.trim()) throw Object.assign(new Error("Enter the business name."), { details: { newBusinessName: ["Enter the business name."] } });
          bid = (await apiRequest(`/api/v1/workspaces/${workspaceId}/businesses`, { method: "POST", body: { name: newBusinessName.trim(), stage: "STARTING" } })).id;
        }
        const created = await apiRequest(base, { method: "POST", body: { ...form, businessId: bid, type: docType } });
        router.push(`/stationery/documents/${created.id}`);
      } else {
        const next = await apiRequest(`${base}/${doc.id}`, { method: "PUT", body: form });
        setDoc(next);
        setForm(toForm(next));
      }
    });
  }

  const changeStatus = (status) => run(status, async () => {
    const next = await apiRequest(`${base}/${doc.id}/status`, { method: "POST", body: { status } });
    setDoc(next);
    setForm(toForm(next));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/stationery/documents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Invoices &amp; quotations</Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{isNew ? `New ${DOCUMENT_TYPES[docType].toLowerCase()}` : `${DOCUMENT_TYPES[docType]} ${doc.number}`}</h1>
          {!isNew && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {doc.business?.name}
              <Badge variant={STATUS_VARIANT[doc.status]}>{STATUS_LABELS[doc.status]}</Badge>
              {doc.overdue && <Badge variant="warning">Overdue</Badge>}
              {doc.sourceQuoteId && <Link className="underline" href={`/stationery/documents/${doc.sourceQuoteId}`}>From quotation</Link>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && <Button variant="outline" asChild><a href={`/print/documents/${doc.id}`} target="_blank" rel="noopener noreferrer"><Printer /> Print / PDF</a></Button>}
          {!isNew && doc.permissions.canEdit && (
            <>
              {doc.type === "QUOTE" && ["SENT", "ACCEPTED"].includes(doc.status) && (
                <Button variant="outline" disabled={busy !== null} onClick={() => run("convert", async () => router.push(`/stationery/documents/${(await apiRequest(`${base}/${doc.id}/convert`, { method: "POST" })).id}`))}><FileText /> Create invoice</Button>
              )}
              <Button variant="outline" disabled={busy !== null} onClick={() => run("dup", async () => router.push(`/stationery/documents/${(await apiRequest(`${base}/${doc.id}/duplicate`, { method: "POST" })).id}`))}><Copy /> Duplicate</Button>
              {doc.transitions.map((s) => (
                <Button key={s} variant={s === "VOID" || s === "DRAFT" ? "outline" : "default"} disabled={busy !== null} onClick={() => changeStatus(s)}>{busy === s && <Loader2 className="animate-spin" />} {ACTION_LABELS[s]}</Button>
              ))}
            </>
          )}
          {editable && <Button onClick={save} disabled={busy !== null}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} {isNew ? "Create" : "Save draft"}</Button>}
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
      {!isNew && !editable && doc.permissions.canEdit && doc.status !== "VOID" && <Alert variant="info"><Info /><AlertDescription>Sent documents are locked so what your customer received stays on record. Use “Back to draft” to correct it, or duplicate it.</AlertDescription></Alert>}
      {isNew && defaults && !defaults.detailsSaved && <Alert variant="info"><Info /><AlertDescription>Add your company address, tax number and payment details in <Link className="font-medium underline" href={`/stationery/details?business=${businessId}`}>Business details</Link> — they are printed on every {DOCUMENT_TYPES[docType].toLowerCase()}.</AlertDescription></Alert>}

      <fieldset disabled={!editable} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="gap-4">
            <h2 className="font-semibold">Customer</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <F id="c-name" label="Name" error={err("customer.name")}><Input id="c-name" value={form.customer.name} onChange={(e) => setCustomer("name", e.target.value)} maxLength={160} /></F>
              <F id="c-company" label="Company (optional)"><Input id="c-company" value={form.customer.company} onChange={(e) => setCustomer("company", e.target.value)} maxLength={160} /></F>
              <F id="c-email" label="Email (optional)" error={err("customer.email")}><Input id="c-email" type="email" value={form.customer.email} onChange={(e) => setCustomer("email", e.target.value)} /></F>
              <F id="c-tax" label="Customer tax number (optional)"><Input id="c-tax" value={form.customer.taxNumber} onChange={(e) => setCustomer("taxNumber", e.target.value)} maxLength={80} /></F>
              <F id="c-address" label="Address (optional)" className="sm:col-span-2"><Textarea id="c-address" rows={2} value={form.customer.address} onChange={(e) => setCustomer("address", e.target.value)} maxLength={500} /></F>
            </div>
          </Card>

          <Card className="gap-4">
            <h2 className="font-semibold">Items</h2>
            <div className="space-y-3">
              <div aria-hidden="true" className="hidden gap-2 text-sm font-medium sm:grid sm:grid-cols-[1fr_80px_110px_80px_auto]">
                <span>Description</span><span>Qty</span><span>Unit price ({form.currency})</span><span>Tax %</span><span className="w-20 text-right">Amount</span>
              </div>
              {form.lines.map((l, i) => {
                const computed = totals?.lines[i];
                return (
                  <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_80px_110px_80px_auto] sm:items-start sm:border-0 sm:p-0">
                    <F id={`l-desc-${i}`} label={`Item ${i + 1} description`} srLabel error={err(`lines.${i}.description`)}><Textarea id={`l-desc-${i}`} rows={1} className="min-h-10" value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} maxLength={300} /></F>
                    <F id={`l-qty-${i}`} label={`Item ${i + 1} quantity`} srLabel error={err(`lines.${i}.quantity`)}><Input id={`l-qty-${i}`} inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} /></F>
                    <F id={`l-price-${i}`} label={`Item ${i + 1} unit price`} srLabel error={err(`lines.${i}.unitPrice`)}><Input id={`l-price-${i}`} inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(i, "unitPrice", e.target.value)} placeholder="0.00" /></F>
                    <F id={`l-tax-${i}`} label={`Item ${i + 1} tax rate (%)`} srLabel error={err(`lines.${i}.taxRate`)}><Input id={`l-tax-${i}`} inputMode="decimal" value={l.taxRate} onChange={(e) => { taxTouched.current = true; setLine(i, "taxRate", e.target.value); }} /></F>
                    <div className="flex items-center justify-between gap-2 sm:w-20 sm:flex-col sm:items-end sm:pt-2.5">
                      <span className="text-sm font-medium tabular-nums" aria-label={`Line ${i + 1} amount`}>{computed ? money(computed.netMinor) : "—"}</span>
                      {editable && form.lines.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${i + 1}`} onClick={() => set("lines", form.lines.filter((_, n) => n !== i))}><Trash2 /></Button>}
                    </div>
                  </div>
                );
              })}
            </div>
            {editable && form.lines.length < 100 && <Button type="button" variant="outline" className="w-fit" onClick={() => set("lines", [...form.lines, emptyLine(defaults?.taxRate ?? form.lines.at(-1)?.taxRate ?? 0)])}><Plus /> Add item</Button>}
            {err("lines") && <p className="text-xs font-medium text-destructive">{err("lines")}</p>}
          </Card>

          <Card className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Text</h2>
              {editable && ai?.configured && (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Input aria-label="What should the text say?" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Optional: what to mention" className="sm:w-64" />
                  <Button type="button" variant="outline" size="sm" disabled={busy !== null || businessId === NEW} onClick={() => run("ai", async () => {
                    const t = await apiRequest(`${base}/draft-text`, { method: "POST", body: { businessId, type: docType, brief, customerName: form.customer.name, lines: form.lines.map((l) => l.description).filter(Boolean) } });
                    setForm((f) => ({ ...f, intro: t.intro || f.intro, notes: t.notes || f.notes, terms: t.terms || f.terms }));
                  })}>{busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} Write with AI</Button>
                </div>
              )}
            </div>
            {docType === "QUOTE" && <F id="d-intro" label="Introduction"><Textarea id="d-intro" rows={3} value={form.intro} onChange={(e) => set("intro", e.target.value)} maxLength={2000} /></F>}
            <F id="d-terms" label="Terms"><Textarea id="d-terms" rows={3} value={form.terms} onChange={(e) => set("terms", e.target.value)} maxLength={2000} /></F>
            <F id="d-notes" label="Note to customer"><Textarea id="d-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} /></F>
            <p className="text-xs text-muted-foreground">AI writes wording only — every number on the document comes from your items.</p>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="gap-4">
            {isNew && (
              <F id="d-business" label="Business">
                <NativeSelect id="d-business" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
                  {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  <option value={NEW}>+ A new business</option>
                </NativeSelect>
              </F>
            )}
            {isNew && businessId === NEW && <F id="d-new" label="Business name" error={err("newBusinessName")}><Input id="d-new" value={newBusinessName} onChange={(e) => setNewBusinessName(e.target.value)} /></F>}
            <F id="d-issue" label={docType === "QUOTE" ? "Date" : "Invoice date"} error={err("issueDate")}><Input id="d-issue" type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)} /></F>
            <F id="d-due" label={docType === "QUOTE" ? "Valid until" : "Due date"} error={err("dueDate")}><Input id="d-due" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></F>
            <F id="d-currency" label="Currency" error={err("currency")}>
              <NativeSelect id="d-currency" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {[...new Set([form.currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}
              </NativeSelect>
            </F>
          </Card>
          <Card className="gap-2" aria-live="polite">
            <h2 className="font-semibold">Totals</h2>
            {totals ? (
              <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right tabular-nums">{money(totals.subtotalMinor)}</dd>
                {totals.taxes.map((t) => <Fragment2 key={t.rate} label={`Tax ${t.rate}%`} value={money(t.amount)} />)}
                <dt className="border-t pt-2 font-semibold">Total</dt><dd className="border-t pt-2 text-right font-semibold tabular-nums" data-testid="doc-total">{money(totals.totalMinor)}</dd>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Check the quantities and prices to see totals.</p>
            )}
            <p className="text-xs text-muted-foreground">Calculated per line, rounded half-up.</p>
          </Card>
          {!isNew && doc.status === "DRAFT" && !doc.sentAt && doc.permissions.canEdit && (
            <Button variant="ghost" className="w-fit text-destructive" disabled={busy !== null} onClick={() => run("delete", async () => { await apiRequest(`${base}/${doc.id}`, { method: "DELETE" }); router.push("/stationery/documents"); })}><Trash2 /> Delete draft</Button>
          )}
        </div>
      </fieldset>
    </div>
  );
}

function Fragment2({ label, value }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </>
  );
}

function F({ id, label, error, children, className, srLabel }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className={srLabel ? "sm:sr-only" : undefined}>{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
