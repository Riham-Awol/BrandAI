/**
 * Platform rules used for validation and warnings (pure, client-safe).
 * Limits are the platforms' published maximums as configured on 2026-11;
 * "recommended" values are best-practice guidance, not hard limits.
 */
export const PLATFORMS = {
  INSTAGRAM: { label: "Instagram", key: "instagram", captionMax: 2200, hashtagMax: 30, hashtagRecommended: 5, videoMaxSeconds: 180, formats: ["POST", "CAROUSEL", "STORY", "SHORT_VIDEO"], carouselMax: 20 },
  FACEBOOK: { label: "Facebook", key: "facebook", captionMax: 63206, hashtagMax: 30, hashtagRecommended: 3, videoMaxSeconds: 90, formats: ["POST", "CAROUSEL", "STORY", "SHORT_VIDEO"], carouselMax: 10 },
  TIKTOK: { label: "TikTok", key: "tiktok", captionMax: 4000, hashtagMax: 30, hashtagRecommended: 5, videoMaxSeconds: 600, formats: ["SHORT_VIDEO", "CAROUSEL", "STORY"], carouselMax: 35 },
  LINKEDIN: { label: "LinkedIn", key: "linkedin", captionMax: 3000, hashtagMax: 30, hashtagRecommended: 5, videoMaxSeconds: 600, formats: ["POST", "CAROUSEL", "SHORT_VIDEO"], carouselMax: 300 },
};
export const PLATFORM_KEYS = Object.keys(PLATFORMS);
export const FORMATS = { POST: "Post", CAROUSEL: "Carousel", STORY: "Story", SHORT_VIDEO: "Reel / short video" };
export const FORMAT_KEYS = Object.keys(FORMATS);

/** "#Sour dough!", "sourdough" → "#sourdough"; deduped case-insensitively. */
export function normalizeHashtags(tags) {
  const seen = new Set();
  const out = [];
  for (const raw of tags ?? []) {
    const clean = String(raw).replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    out.push(`#${clean}`);
  }
  return out;
}

/** The text that will actually be posted: caption, call to action, hashtags. */
export function composeCaption(content) {
  const parts = [content.caption?.trim(), content.callToAction?.trim(), (content.hashtags ?? []).join(" ")].filter(Boolean);
  return parts.join("\n\n");
}

/** Computed checks for a post against its platform's rules. */
export function checkPost(platform, format, content) {
  const rules = PLATFORMS[platform];
  const warnings = [];
  const caption = composeCaption(content ?? {});
  const hashtags = content?.hashtags ?? [];
  const durationSeconds = (content?.scenes ?? []).reduce((sum, s) => sum + (Number(s.seconds) || 0), 0);
  if (!rules.formats.includes(format)) warnings.push(`${FORMATS[format]} is not supported on ${rules.label}.`);
  if (caption.length > rules.captionMax) warnings.push(`Caption is ${caption.length} characters; ${rules.label} allows ${rules.captionMax}.`);
  if (hashtags.length > rules.hashtagMax) warnings.push(`${hashtags.length} hashtags; ${rules.label} allows ${rules.hashtagMax}.`);
  else if (hashtags.length > rules.hashtagRecommended) warnings.push(`${hashtags.length} hashtags; ${rules.hashtagRecommended} or fewer usually performs better on ${rules.label}.`);
  if (format === "CAROUSEL" && content) {
    const n = content.slides?.length ?? 0;
    if (n < 2) warnings.push("A carousel needs at least 2 slides.");
    if (n > rules.carouselMax) warnings.push(`${n} slides; ${rules.label} allows ${rules.carouselMax}.`);
  }
  if (format === "SHORT_VIDEO" && content) {
    if (durationSeconds === 0) warnings.push("The video script has no timed scenes.");
    if (durationSeconds > rules.videoMaxSeconds) warnings.push(`Video runs ${durationSeconds}s; ${rules.label} allows ${rules.videoMaxSeconds}s.`);
  }
  if (format === "STORY" && content && (content.frames?.length ?? 0) === 0) warnings.push("A story needs at least one frame.");
  return { captionLength: caption.length, captionMax: rules.captionMax, hashtagCount: hashtags.length, durationSeconds, warnings };
}

/** Removes parts that don't belong to the format, normalizes hashtags and timings. */
export function normalizePostContent(content, { format, isPromotion }) {
  const scenes = format === "SHORT_VIDEO" ? content.scenes.map((s) => ({ ...s, seconds: Math.max(1, Math.min(600, Math.round(Number(s.seconds) || 1))) })) : [];
  return {
    ...content,
    hashtags: normalizeHashtags(content.hashtags),
    slides: format === "CAROUSEL" ? content.slides : [],
    frames: format === "STORY" ? content.frames : [],
    scenes,
    audio: format === "SHORT_VIDEO" ? content.audio : "",
    promotion: isPromotion ? content.promotion : { offer: "", code: "", validUntil: "", terms: "" },
  };
}

export function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function dateForDay(month, day) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function weekday(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
}
