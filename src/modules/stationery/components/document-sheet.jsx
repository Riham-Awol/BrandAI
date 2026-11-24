/**
 * Printable invoice / quotation (A4). Plain component (no hooks): used by the
 * print page and the in-app preview. All amounts come from the server's
 * computed values (minor units) and are formatted here.
 */
import { contrastRatio } from "@/modules/brand/color.js";
import { SITE_FONT_STACKS, siteFontCss } from "@/modules/website/site-theme.js";
import { addressLines, websiteLabel } from "../details.js";
import { DOCUMENT_TYPES, STATUS_LABELS } from "../documents.js";
import { currencyDecimals, formatMoney, formatQuantity, parseDecimal } from "../money.js";

function accentFor(brand) {
  const c = brand?.colors ?? {};
  return [c.primary, c.dark, "#302442"].find((x) => x && contrastRatio(x, "#ffffff") >= 4.5) ?? "#302442";
}

const fmtDate = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");

export function DocumentSheet({ document: doc, brand, details }) {
  const accent = accentFor(brand);
  const money = (m) => formatMoney(m, doc.currency);
  const company = details.legalName || brand.name;
  const title = DOCUMENT_TYPES[doc.type];
  const showStatus = ["PAID", "VOID", "ACCEPTED", "DECLINED"].includes(doc.status);
  return (
    <article className="doc-sheet mx-auto bg-white text-[#1d1b22]" style={{ fontFamily: SITE_FONT_STACKS.body, "--doc-accent": accent }} aria-label={`${title} ${doc.number}`}>
      <style>{siteFontCss(brand)}</style>
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 space-y-3">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- server-rendered vector logo
            <img src={brand.logo} alt={brand.name} className="h-14 w-auto max-w-[260px] object-contain object-left" />
          ) : (
            <p className="text-2xl font-semibold" style={{ fontFamily: SITE_FONT_STACKS.heading, color: accent }}>{brand.name}</p>
          )}
          <div className="text-[13px] leading-relaxed text-[#4a4752]">
            <p className="font-semibold text-[#1d1b22]">{company}</p>
            {addressLines(details).map((l) => <p key={l}>{l}</p>)}
            {[details.email, details.phone, websiteLabel(details.website)].filter(Boolean).map((l) => <p key={l}>{l}</p>)}
            {details.taxNumber && <p>Tax / VAT no. {details.taxNumber}</p>}
            {details.registrationNumber && <p>Company no. {details.registrationNumber}</p>}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: SITE_FONT_STACKS.heading, color: accent }}>{title}</h1>
          <p className="mt-1 text-lg font-medium">{doc.number}</p>
          {showStatus && <p className="mt-2 inline-block rounded border-2 px-3 py-1 text-sm font-bold uppercase tracking-wider" style={{ borderColor: accent, color: accent }}>{STATUS_LABELS[doc.status]}</p>}
        </div>
      </header>

      <section className="mt-10 grid gap-6 text-[13px] sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#6b6875]">{doc.type === "QUOTE" ? "Prepared for" : "Bill to"}</p>
          <p className="font-semibold">{doc.customer.name}</p>
          {doc.customer.company && <p>{doc.customer.company}</p>}
          {doc.customer.address && <p className="whitespace-pre-line">{doc.customer.address}</p>}
          {doc.customer.email && <p>{doc.customer.email}</p>}
          {doc.customer.taxNumber && <p>Tax / VAT no. {doc.customer.taxNumber}</p>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
          <dt className="text-[#6b6875]">{doc.type === "QUOTE" ? "Date" : "Invoice date"}</dt><dd className="text-right font-medium">{fmtDate(doc.issueDate)}</dd>
          {doc.dueDate && <><dt className="text-[#6b6875]">{doc.type === "QUOTE" ? "Valid until" : "Due date"}</dt><dd className="text-right font-medium">{fmtDate(doc.dueDate)}</dd></>}
          <dt className="text-[#6b6875]">Amount {doc.type === "QUOTE" ? "" : "due"}</dt><dd className="text-right font-semibold">{money(doc.totalMinor)}</dd>
        </dl>
      </section>

      {doc.intro && <p className="mt-8 whitespace-pre-line text-[14px] leading-relaxed">{doc.intro}</p>}

      <table className="mt-8 w-full border-collapse text-[13px]">
        <caption className="sr-only">Line items</caption>
        <thead>
          <tr className="border-b-2 text-left" style={{ borderColor: accent }}>
            <th scope="col" className="py-2 pr-3 font-semibold">Description</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Qty</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Unit price</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Tax</th>
            <th scope="col" className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={i} className="border-b border-[#e6e3ea] align-top">
              <td className="whitespace-pre-line py-2.5 pr-3">{l.description}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{formatQuantity(l.quantity)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{money(unitMinor(l, doc.currency))}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{Number(l.taxRate)}%</td>
              <td className="py-2.5 text-right tabular-nums">{money(l.netMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <dl className="grid w-full max-w-xs grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
          <dt className="text-[#6b6875]">Subtotal</dt><dd className="text-right tabular-nums">{money(doc.subtotalMinor)}</dd>
          {doc.taxes.map((t) => <Tax key={t.rate} rate={t.rate} amount={money(t.amount)} />)}
          <dt className="border-t-2 pt-2 text-base font-semibold" style={{ borderColor: accent }}>Total</dt>
          <dd className="border-t-2 pt-2 text-right text-base font-semibold tabular-nums" style={{ borderColor: accent }}>{money(doc.totalMinor)}</dd>
        </dl>
      </div>

      <footer className="mt-10 space-y-5 text-[13px] leading-relaxed">
        {doc.type === "INVOICE" && details.bankDetails && (
          <div><p className="mb-1 font-semibold">Payment details</p><p className="whitespace-pre-line">{details.bankDetails}</p><p className="mt-1 text-[#6b6875]">Please use {doc.number} as the payment reference.</p></div>
        )}
        {doc.terms && <div><p className="mb-1 font-semibold">Terms</p><p className="whitespace-pre-line">{doc.terms}</p></div>}
        {doc.notes && <p className="whitespace-pre-line">{doc.notes}</p>}
        {doc.type === "QUOTE" && (
          <div className="grid gap-8 pt-6 sm:grid-cols-2">
            <p className="border-t border-[#b9b5c2] pt-2 text-[#6b6875]">Accepted by (name and signature)</p>
            <p className="border-t border-[#b9b5c2] pt-2 text-[#6b6875]">Date</p>
          </div>
        )}
      </footer>
    </article>
  );
}

function Tax({ rate, amount }) {
  return (
    <>
      <dt className="text-[#6b6875]">Tax {rate}%</dt>
      <dd className="text-right tabular-nums">{amount}</dd>
    </>
  );
}

function unitMinor(line, currency) {
  return parseDecimal(line.unitPrice, currencyDecimals(currency)) ?? 0n;
}
