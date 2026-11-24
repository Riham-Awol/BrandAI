import "server-only";
import { FORMATS, PLATFORMS, daysInMonth, weekday } from "./platforms.js";
import { SOCIAL_SECTION_BY_KEY } from "./sections.js";

const COMMON = [
  "You are a senior social media strategist and copywriter in Brand AI's Social Media Studio.",
  "Write in the approved brand voice and use the approved brand, audience, personas, channels and messaging from the business context.",
  "Be specific to this business and its location; avoid generic filler, clickbait and false claims. Never invent prices, reviews or statistics.",
  "Respect each platform's culture and limits. Write in English unless the business context clearly indicates another language.",
].join(" ");

const rules = (platforms) =>
  platforms.map((p) => `${PLATFORMS[p].label}: formats ${PLATFORMS[p].formats.map((f) => FORMATS[f]).join(", ")}; caption max ${PLATFORMS[p].captionMax} chars; ${PLATFORMS[p].hashtagRecommended} hashtags recommended`).join("\n");

export function buildInstructions(section, project) {
  const i = project.input;
  const total = Math.max(1, Math.round((i.postsPerWeek * daysInMonth(i.month)) / 7));
  const tasks = {
    pillars: `Define 3-5 content pillars (shares adding up to 100%), a plan per selected platform (role, posts per week, formats, best posting times for the audience's timezone, tone), 2-3 hashtag sets per pillar (mix of broad, niche and local), and practical guidelines.`,
    calendar: `Plan ${total} posts for ${i.month} (days 1-${daysInMonth(i.month)}) spread across the selected platforms and the pillars' shares. Use only allowed formats per platform. Vary formats; avoid posting the same idea on the same day. ${i.includePromotions ? "Include 1-3 promotion posts (isPromotion true) tied to the focus." : "Do not include promotions (isPromotion false)."} Mention relevant dates/holidays for the business's country in notes only if you are sure of them.`,
  };
  return `${COMMON}\n\nSelected platforms and their rules:\n${rules(i.platforms)}\n\nTask — ${SOCIAL_SECTION_BY_KEY[section].title}: ${tasks[section]}`;
}

export function buildSocialInput({ project, previous, feedback, currentContent }) {
  const i = project.input;
  const lines = [
    `<business>\nName: ${project.business.name}\nIndustry: ${project.business.industry ?? "not specified"}\nDescription: ${project.business.description ?? "not specified"}\n</business>`,
    `<plan>\nMonth: ${i.month}\nPlatforms: ${i.platforms.map((p) => PLATFORMS[p].label).join(", ")}\nPosts per week: ${i.postsPerWeek}\nFocus this month: ${i.focus ?? "none stated"}\nPromotions: ${i.includePromotions ? "yes" : "no"}\n</plan>`,
  ];
  for (const [key, entry] of Object.entries(previous)) lines.push(`<previous_result section="${key}">\n${JSON.stringify(entry.content)}\n</previous_result>`);
  if (feedback) {
    if (currentContent) lines.push(`<current_version>\n${JSON.stringify(currentContent)}\n</current_version>`);
    lines.push(`<revision_request>\n${feedback}\n</revision_request>\nRevise the current version according to the revision request.`);
  }
  return lines.join("\n\n");
}

export const SOCIAL_AI_OPTIONS = { pillars: { effort: "medium", maxTokens: 6000 }, calendar: { effort: "medium", maxTokens: 10000 } };

/** Instructions for writing a batch of posts. */
export function postsInstructions(platforms) {
  return `${COMMON}\n\nPlatform rules:\n${rules(platforms)}\n\nTask — Write the requested posts. Return one item per requested post with the same ref. For each: a strong hook, caption (no hashtags inside), hashtags (without spaces), a clear call to action, alt text, and a visual idea. Fill slides only for Carousel (5-8 slides), frames only for Story (3-5 frames, with an interactive element such as a poll or question), scenes only for Reel/short video (timed scenes totalling 15-60 seconds, with voiceover and on-screen text) plus an audio suggestion. Fill promotion only for promotion posts; never invent discount values that are not in the focus or brief — use a placeholder like "[your offer]" instead.`;
}

export function postsInput({ project, posts, pillars, feedback }) {
  const lines = [
    `<business>\nName: ${project.business.name}\nIndustry: ${project.business.industry ?? "not specified"}\n</business>`,
    `<month_focus>\n${project.input.focus ?? "none stated"}\n</month_focus>`,
  ];
  if (pillars) lines.push(`<social_strategy>\n${JSON.stringify({ pillars: pillars.pillars, hashtagSets: pillars.hashtagSets, guidelines: pillars.guidelines })}\n</social_strategy>`);
  for (const [n, p] of posts.entries()) {
    const date = p.scheduledDate.toISOString().slice(0, 10);
    lines.push(
      `<post ref="${n + 1}">\nDate: ${date} (${weekday(date)})\nPlatform: ${PLATFORMS[p.platform].label}\nFormat: ${FORMATS[p.format]}\nPillar: ${p.pillar ?? "-"}\nTitle: ${p.title}\nObjective: ${p.objective ?? "-"}\nPromotion: ${p.isPromotion ? "yes" : "no"}${p.content ? `\nCurrent draft: ${JSON.stringify(p.content)}` : ""}\n</post>`,
    );
  }
  if (feedback) lines.push(`<revision_request>\n${feedback}\n</revision_request>`);
  return lines.join("\n\n");
}
