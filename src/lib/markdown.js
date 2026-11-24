import { humanize } from "./humanize";

/** Escapes characters that would change Markdown structure in user/AI text. */
export function mdEscape(text) {
  return String(text ?? "").replace(/([\\`*_{}[\]<>#|])/g, "\\$1");
}

const TITLE_KEYS = ["name", "title", "task", "problem", "milestone", "item", "risk", "channel", "platform", "stage", "period", "pillar"];

/** Renders structured content (objects, lists, scalars) as readable Markdown. */
export function renderStructured(value, depth = 0) {
  if (value == null || value === "") return "";
  if (typeof value !== "object") return mdEscape(value);
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object")) return value.map((v) => `- ${mdEscape(v)}`).join("\n");
    return value.map((item) => renderObject(item, depth + 1, true)).join("\n\n");
  }
  return renderObject(value, depth + 1, false);
}

function renderObject(obj, depth, asItem) {
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0));
  const titleKey = asItem ? TITLE_KEYS.find((k) => typeof obj[k] === "string") : null;
  const lines = [];
  if (titleKey) lines.push(`${"#".repeat(Math.min(6, depth + 2))} ${mdEscape(obj[titleKey])}`);
  for (const [key, value] of entries) {
    if (key === titleKey) continue;
    if (typeof value === "object") lines.push(`**${humanize(key)}**\n\n${renderStructured(value, depth)}`);
    else lines.push(`**${humanize(key)}:** ${mdEscape(value)}`);
  }
  return lines.join("\n\n");
}

/** RFC 4180 CSV with formula-injection protection for spreadsheet apps. */
export function toCsv(rows) {
  const cell = (v) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
