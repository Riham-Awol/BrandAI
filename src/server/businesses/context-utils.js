/** Returns only the approved sections of a context snapshot (pure). */
export function pickApprovedSections(data, approvedSections) {
  const allowed = new Set(Array.isArray(approvedSections) ? approvedSections : []);
  return Object.fromEntries(Object.entries(data ?? {}).filter(([key, value]) => allowed.has(key) && value != null));
}

/** Renders approved context as a compact, deterministic prompt block (pure). */
export function renderContextForPrompt(context) {
  if (!context || Object.keys(context.data).length === 0) return "";
  const sorted = Object.keys(context.data).sort().reduce((acc, k) => ({ ...acc, [k]: context.data[k] }), {});
  return `<business_context version="${context.version}">\n${JSON.stringify(sorted, null, 2)}\n</business_context>`;
}
