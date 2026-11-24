import { contrastRatio, normalizeHex } from "@/modules/brand/color.js";

/**
 * Builds a campaign email (HTML + plain text) from validated content. Pure.
 * Every value is HTML-escaped; links are https only (validated upstream);
 * the footer carries the sender's address and an unsubscribe link (required
 * by anti-spam laws such as CAN-SPAM and the UK PECR/GDPR).
 */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function accent(colors) {
  const c = [normalizeHex(colors?.primary), normalizeHex(colors?.dark), "#302442"].find((x) => x && contrastRatio(x, "#ffffff") >= 4.5);
  return c ?? "#302442";
}

export function renderCampaignEmail({ subject, preheader, content, brandName, colors, senderAddress, unsubscribeUrl }) {
  const a = accent(colors);
  const paragraphs = content.paragraphs.filter(Boolean);
  const cta = content.ctaLabel && content.ctaUrl
    ? `<tr><td style="padding:8px 32px 24px"><a href="${esc(content.ctaUrl)}" style="display:inline-block;background:${a};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${esc(content.ctaLabel)}</a></td></tr>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f4f2f7;font-family:Helvetica,Arial,sans-serif;color:#1d1b22">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="padding:24px 32px;background:${a};color:#ffffff;font-size:20px;font-weight:700">${esc(brandName)}</td></tr>
${content.heading ? `<tr><td style="padding:28px 32px 8px;font-size:24px;line-height:1.25;font-weight:700">${esc(content.heading)}</td></tr>` : ""}
${paragraphs.map((p) => `<tr><td style="padding:8px 32px;font-size:16px;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</td></tr>`).join("\n")}
${cta}
<tr><td style="padding:24px 32px;border-top:1px solid #e6e3ea;font-size:12px;line-height:1.5;color:#6b6875">${esc(brandName)}${senderAddress ? ` · ${esc(senderAddress)}` : ""}<br>You're receiving this because you agreed to hear from ${esc(brandName)}. <a href="${esc(unsubscribeUrl)}" style="color:#6b6875">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [content.heading, ...paragraphs, content.ctaLabel && content.ctaUrl ? `${content.ctaLabel}: ${content.ctaUrl}` : "", "—", `${brandName}${senderAddress ? `, ${senderAddress}` : ""}`, `Unsubscribe: ${unsubscribeUrl}`].filter(Boolean).join("\n\n");
  return { html, text };
}

/** Minimal CSV parser (quotes, commas, CRLF). Returns rows of strings. Pure. */
export function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const s = String(input).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Contacts from CSV rows: finds the email (and optional name) column. Pure. */
export function contactsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { contacts: [], invalid: 0 };
  // Header names are compared without spaces/punctuation ("E-mail address" → "emailaddress").
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
  const hasHeader = header.some((h) => h.includes("email"));
  const emailCol = hasHeader ? header.findIndex((h) => h.includes("email")) : 0;
  const nameCol = hasHeader ? header.findIndex((h) => ["name", "fullname", "firstname", "contactname"].includes(h)) : 1;
  const re = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
  const seen = new Set();
  const contacts = [];
  let invalid = 0;
  for (const r of rows.slice(hasHeader ? 1 : 0)) {
    const email = (r[emailCol] ?? "").trim().toLowerCase();
    if (!re.test(email) || email.length > 254) { invalid++; continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    contacts.push({ email, name: (nameCol >= 0 ? r[nameCol] ?? "" : "").trim().slice(0, 120) || null });
  }
  return { contacts, invalid };
}
