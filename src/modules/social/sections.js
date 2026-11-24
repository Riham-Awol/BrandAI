/** Social Media Studio steps (client-safe). Posts and export are not AI sections. */
export const SOCIAL_SECTIONS = [
  { key: "pillars", title: "Social strategy", short: "Strategy", description: "Content pillars, a plan per platform and hashtag sets.", uses: [] },
  { key: "calendar", title: "Content calendar", short: "Calendar", description: "A month of post ideas across your platforms.", uses: ["pillars"] },
];
export const SOCIAL_SECTION_BY_KEY = Object.fromEntries(SOCIAL_SECTIONS.map((s) => [s.key, s]));
export const POSTS_STEP = { key: "posts", title: "Posts", short: "Posts", description: "Write, edit and finish each post." };
