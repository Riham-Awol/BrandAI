# ADR 012 — Websites as structured configs; publishing and custom domains

**Context.** Phase 6 must produce functional published websites without letting AI execute code on the server.

**Options.** AI-generated HTML/JSX (sandboxed or not) · a page-builder JSON format rendered by our components ·
exporting static files to an external host.

**Decision.**
- A site is a validated JSON config (pages → sections of 12 whitelisted types with text, items, links, image
  ids). AI fills it through a schema; code keeps only planned pages/section types and normalizes links/icons.
- One set of hook-free React components renders both the public site (server) and the editor preview (client);
  layout uses container queries so the phone preview matches real devices.
- Publishing writes an immutable snapshot (config + resolved brand with the logo rendered to a vector data URI)
  to `website_versions`; public routes read only the published snapshot.
- Public URLs: `/sites/:slug`. Custom domains: TXT-record ownership check, then the proxy rewrites requests for
  that host to `/sites/:host/...`; only VERIFIED domains resolve. TLS is the hosting platform's job.
- Forms are plain HTML POSTs (no client JS) to a public route with same-origin check, honeypot and IP rate limit.

**Consequences.**
+ No generated code is ever executed; content is escaped by React; one renderer to test.
+ Rollback is "copy a version to the draft and republish". − Layout freedom is limited to section types/styles.
− Not-found pages return 200 + noindex under Cache Components (documented). − Custom-domain HTTPS depends on hosting.
