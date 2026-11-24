import { mdEscape, toCsv } from "@/lib/markdown";
import { FORMATS, PLATFORMS, composeCaption, weekday } from "./platforms.js";

/** CSV for scheduling tools / spreadsheets (formula-injection safe). */
export function postsCsv(posts) {
  return toCsv([
    ["Date", "Day", "Platform", "Format", "Status", "Title", "Pillar", "Text to post", "Hashtags", "Alt text", "Visual idea", "Carousel slides", "Story frames", "Video script", "Promo code"],
    ...posts.map((p) => {
      const c = p.content ?? {};
      return [
        p.scheduledDate, weekday(p.scheduledDate), PLATFORMS[p.platform].label, FORMATS[p.format], p.status, p.title, p.pillar ?? "",
        p.content ? [c.hook, composeCaption(c)].filter(Boolean).join("\n\n") : "", (c.hashtags ?? []).join(" "), c.altText ?? "", c.visualIdea ?? "",
        (c.slides ?? []).map((s, i) => `${i + 1}. ${s.heading}: ${s.text}`).join("\n"),
        (c.frames ?? []).map((f, i) => `${i + 1}. ${f.text} [${f.interactive}]`).join("\n"),
        (c.scenes ?? []).map((s) => `${s.seconds}s — ${s.visual} / VO: ${s.voiceover} / Text: ${s.onScreenText}`).join("\n"),
        c.promotion?.code ?? "",
      ];
    }),
  ]);
}

export function postsMarkdown(posts, project) {
  const parts = [`# ${mdEscape(project.business.name)} — social posts for ${project.input.month}`, "_Generated with Brand AI Social Media Studio. Review before publishing._"];
  for (const p of posts) {
    const c = p.content;
    parts.push(`## ${p.scheduledDate} (${weekday(p.scheduledDate)}) · ${PLATFORMS[p.platform].label} · ${FORMATS[p.format]}`, `**${mdEscape(p.title)}** — ${p.status.toLowerCase()}${p.isMock ? " · sample data from the mock AI provider" : ""}`);
    if (!c) {
      parts.push("_Not written yet._");
      continue;
    }
    parts.push(`> ${mdEscape(c.hook)}`, mdEscape(composeCaption(c)));
    if (c.slides.length) parts.push(c.slides.map((s, i) => `${i + 1}. **${mdEscape(s.heading)}** — ${mdEscape(s.text)}`).join("\n"));
    if (c.frames.length) parts.push(c.frames.map((f, i) => `${i + 1}. ${mdEscape(f.text)} _(${mdEscape(f.interactive)})_`).join("\n"));
    if (c.scenes.length) parts.push(["| s | Visual | Voiceover | On-screen text |", "|---:|---|---|---|", ...c.scenes.map((s) => `| ${s.seconds} | ${mdEscape(s.visual)} | ${mdEscape(s.voiceover)} | ${mdEscape(s.onScreenText)} |`)].join("\n"));
    if (c.promotion?.code || c.promotion?.offer) parts.push(`**Promotion:** ${mdEscape(c.promotion.offer)} · code ${mdEscape(c.promotion.code)} · until ${mdEscape(c.promotion.validUntil)} · ${mdEscape(c.promotion.terms)}`);
    parts.push(`_Alt text:_ ${mdEscape(c.altText)}  \n_Visual:_ ${mdEscape(c.visualIdea)}`);
  }
  return parts.join("\n\n") + "\n";
}
