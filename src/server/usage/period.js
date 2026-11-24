/** Start of the current usage period in UTC (pure). */
export function periodStart(period, now = new Date()) {
  if (period === "DAILY") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
