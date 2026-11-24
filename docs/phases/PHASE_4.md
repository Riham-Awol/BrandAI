# Phase 4 — AI Social Media Studio

Status: COMPLETE (awaiting approval)

## 1. Scope
- Monthly social plan per business: month, platforms (Instagram, Facebook, TikTok, LinkedIn), posts per week,
  focus (real offers live here — the AI is told never to invent discounts), promotions on/off.
- Studio sections (shared engine): **social strategy** (content pillars with computed shares, plan per
  platform, hashtag sets, guidelines) and **content calendar** (entries filtered in code to the month,
  selected platforms and formats each platform supports).
- **Posts**: created from the calendar (idempotent; re-planning replaces unwritten ideas only) or with the
  quick "Add a post" tool (individual-tool path). Written in batches of up to 6 per AI call.
  Content per post: hook, caption, hashtags, call to action, alt text, visual idea; carousel slides, story
  frames (with interactive element), Reel/TikTok scripts (timed scenes + audio), promotion details.
- Per-format clean-up, hashtag normalization, and computed platform checks (caption length incl. CTA and
  hashtags, hashtag limits/recommendations, carousel size, video duration from scene timings).
- Post editor: preview, live checks, copy caption, status (Idea → Draft → Ready), rewrite with instructions,
  revision history with restore, delete.
- Exports: CSV for scheduling tools (formula-injection safe) and Markdown.
- Out of scope: publishing/scheduling to platforms and approvals (Phase 8), images (Phase 5), analytics (Phase 9).

## 2. Database — migration `phase4_social_studio`
`ProjectType.SOCIAL_STUDIO`; `social_posts`, `social_post_revisions`; enums `SocialPlatform`,
`SocialFormat`, `SocialPostStatus`, `SocialRevisionSource`.

## 3. Acceptance criteria
- [x] Plan created for an existing or new business; settings validated.
- [x] Strategy and calendar generate with structured output using brand voice + marketing plan context.
- [x] Calendar entries validated against month, platforms and formats.
- [x] Posts from calendar (idempotent) and quick single posts; batch writing (≤6 per call); skipped posts reported.
- [x] Captions, hashtags, Instagram/Facebook/TikTok/LinkedIn formats, stories, carousels, reels/video scripts, promotions.
- [x] Editing with revision history; platform checks computed in code; copy; status workflow.
- [x] CSV/Markdown exports.
- [x] Workspace isolation, cross-project ids and viewer permissions tested; responsive + dark mode; regression passes.
