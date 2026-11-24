# ADR 009 — Free logo generation: AI-designed specs rendered as vector SVG

**Context.** Phase 2 needs logo generation and variations. Image models cost money (owner asked for free
options), produce raster images that are poor for logos (blurry text, no vectors, hard to recolour), and
free hosted generators have uncertain terms and availability.

**Options.** (a) Paid image API; (b) free hosted image generator (Pollinations, HF Inference);
(c) LLM writes raw SVG; (d) LLM produces a structured logo specification rendered by our own code.

**Decision.** (d). Claude (already approved) returns specs constrained by a Zod schema: mark type
(icon / monogram / wordmark), a curated Lucide icon (143, ISC licence), container shape, one of 15 bundled
SIL-OFL fonts, weight, case, tracking and colours. The server normalizes/repairs the spec and renders SVG:
glyphs are converted to outline paths with opentype.js (our own layout + serializer), icons come from
Lucide geometry. (c) was rejected because executing/serving model-written markup is an XSS and quality risk.

**Consequences.**
+ Free, deterministic, crisp at any size, trivially recoloured (variants/themes), editable by users, no
  stored image files (rendered from the approved spec).
+ Output contains no text nodes or user markup; served with a sandboxing CSP.
− Logos are typographic/icon compositions, not bespoke illustrations. An image provider can be added later
  behind the existing `getImageProvider()` boundary (e.g. for Phase 5 illustrative designs).
− Latin-only wordmarks with the bundled subsets; others fall back to Inter with a warning.
