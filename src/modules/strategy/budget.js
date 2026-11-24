/**
 * Budget maths (pure). Totals and percentages are always computed here from
 * the line items — never trusted from AI output.
 */
const round2 = (n) => Math.round(n * 100) / 100;

export function computeBudget(budget, { statedMonthly } = {}) {
  const allocations = (budget.allocations ?? []).map((a) => ({ ...a, monthlyAmount: Math.max(0, round2(Number(a.monthlyAmount) || 0)) }));
  const totalMonthly = round2(allocations.reduce((sum, a) => sum + a.monthlyAmount, 0));
  const withShare = allocations.map((a) => ({ ...a, share: totalMonthly > 0 ? round2((a.monthlyAmount / totalMonthly) * 100) : 0 }));
  const phasing = (budget.phasing ?? []).map((p) => ({ ...p, amount: Math.max(0, round2(Number(p.amount) || 0)) }));
  const phasedTotal = round2(phasing.reduce((sum, p) => sum + p.amount, 0));
  const stated = Number.isFinite(statedMonthly) ? statedMonthly : null;
  return {
    currency: String(budget.currency ?? "USD").trim().toUpperCase().slice(0, 3),
    allocations: withShare,
    totalMonthly,
    totalFirstYear: phasing.length ? phasedTotal : round2(totalMonthly * 12),
    statedMonthly: stated,
    overBudget: stated !== null && totalMonthly > stated * 1.05,
  };
}

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en")}`;
  }
}
