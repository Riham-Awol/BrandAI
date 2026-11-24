/**
 * Money maths for invoices and quotations (client-safe, pure). Amounts are
 * integer minor units (BigInt); quantities are thousandths; tax rates are basis
 * points. Rounding is half-up per line, as on a paper invoice.
 */

export function currencyDecimals(currency) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

/** "12.5" → 1250n (for 2 decimals). Returns null when the text is not a valid amount. */
export function parseDecimal(text, decimals) {
  const s = String(text ?? "").trim().replace(/,/g, "");
  const m = s.match(/^(\d{1,12})(?:\.(\d+))?$/);
  if (!m || (m[2] && m[2].length > decimals)) return null;
  return BigInt(m[1]) * 10n ** BigInt(decimals) + BigInt((m[2] ?? "").padEnd(decimals, "0") || "0");
}

const divRound = (a, b) => (a >= 0n ? (a * 2n + b) / (b * 2n) : -((-a * 2n + b) / (b * 2n)));

/** Computes line amounts and totals. Throws on invalid numbers (callers validate first). */
export function computeTotals(lines, currency) {
  const d = currencyDecimals(currency);
  let subtotal = 0n;
  let tax = 0n;
  const out = lines.map((line) => {
    const qtyMilli = parseDecimal(line.quantity, 3);
    const unit = parseDecimal(line.unitPrice, d);
    if (qtyMilli === null || unit === null) throw new Error("Invalid line amount");
    const rateBp = BigInt(Math.round(Number(line.taxRate) * 100));
    const net = divRound(qtyMilli * unit, 1000n);
    const lineTax = divRound(net * rateBp, 10000n);
    subtotal += net;
    tax += lineTax;
    return { ...line, netMinor: net, taxMinor: lineTax };
  });
  return { lines: out, subtotalMinor: subtotal, taxMinor: tax, totalMinor: subtotal + tax };
}

/** Tax subtotals per rate (for the totals box). */
export function taxBreakdown(computedLines) {
  const map = new Map();
  for (const l of computedLines) {
    const key = Number(l.taxRate);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0n) + l.taxMinor);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([rate, amount]) => ({ rate, amount }));
}

export function formatMoney(minor, currency, locale = "en-GB") {
  const d = currencyDecimals(currency);
  const value = BigInt(minor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const units = abs / 10n ** BigInt(d);
  const frac = abs % 10n ** BigInt(d);
  // Intl handles grouping and the symbol; the decimal part is exact (no float rounding).
  const formatted = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(`${units}.${String(frac).padStart(d, "0")}`));
  return negative ? `-${formatted}` : formatted;
}

export function formatQuantity(q) {
  const n = parseDecimal(q, 3);
  if (n === null) return q;
  const whole = n / 1000n;
  const frac = String(n % 1000n).padStart(3, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
