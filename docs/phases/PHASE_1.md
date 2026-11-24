# Phase 1 — AI Business Launch Studio

Status: COMPLETE (awaiting approval)

## 1. Scope
**In scope**
- Business idea input (new business, or an existing business in the workspace).
- Ten AI sections, each generated with structured output, saved as versions, editable, regenerable
  with revision instructions, and acceptable:
  `idea_analysis`, `names`, `industry`, `audience`, `problems`, `competitors`,
  `business_model`, `strategy`, `business_plan`, `launch_checklist`.
- Launch checklist progress tracking.
- Business profile builder: pre-filled from accepted/latest outputs, editable, saved into
  structured profile tables, then synced into the central business context (draft → approval).
- Business profile page for any business (works without the guided journey).
- Markdown export of the launch pack.

**Out of scope** (later phases): live web research for competitors (outputs are AI-knowledge based and
labelled as such), PDF/DOCX export, collaboration/comments, brand identity (Phase 2).

## 2. Dependencies & reused services
`generateText()` orchestrator (context injection, usage limits, cost tracking, audit),
`requireWorkspaceAccess` + permissions, business service, context service, `route()` wrapper,
design system, Zod validation.

## 3. Database changes — migration `phase1_launch_studio`
- `businesses`: + `value_proposition`, `business_model`.
- `projects` (generic studio project; type `LAUNCH_STUDIO`), `project_outputs` (versioned section outputs).
- Profile tables: `business_products`, `business_services`, `business_locations`, `business_audiences`,
  `business_customer_problems`, `competitors`, `business_goals`.

## 4. API endpoints
See docs/API_DOCUMENTATION.md § Launch Studio and § Business profile.

## 5. UI
`/launch` (projects), `/launch/new` (idea form), `/launch/[projectId]` (studio with section
navigation, generate/edit/regenerate/accept, versions, checklist, profile builder),
`/businesses/[businessId]` (profile + context approval). Sidebar link enabled.

## 6. AI tasks
Module `launch`, one task per section. Inputs: idea input + previous section outputs (accepted
version, else latest) + approved business context. Output schemas in `src/modules/launch/schemas.js`.

## 7. Acceptance criteria
- [x] A user can enter an idea and a business + launch project are created in the active workspace.
- [x] Each section can be generated, viewed, edited (server-validated), regenerated with instructions,
      and older versions remain available; one version can be accepted.
- [x] Generation records usage/cost and respects permissions, rate and usage limits.
- [x] Missing AI credentials produce a clear "not configured" message, never fake output.
- [x] Checklist items can be ticked and progress persists.
- [x] Profile builder pre-fills from outputs, saves structured profile tables, creates a context draft;
      an admin/owner approves sections for reuse.
- [x] Existing businesses can open/edit their profile without the guided journey.
- [x] Launch pack exports as Markdown.
- [x] All data is workspace-isolated (tests), viewers are read-only (tests).
- [x] Responsive + dark mode; loading/empty/error states.
- [x] Phase 0 regression suite passes.

## 8. Test plan & results
| Suite | New in Phase 1 | Result |
|---|---|---|
| Unit | launch schemas/prompts/markdown/fixtures, structured editor helpers, profile mapping, StructuredView | 20 new, all passing |
| Integration (MySQL) | `tests/integration/launch-studio.test.js` — generation, versions, edits, accept, checklist, export, profile + context, permissions, isolation | 17 new, all passing |
| E2E | full studio journey; cross-workspace access; mobile studio | 3 new, all passing |
| Regression | all Phase 0 suites | passing |

## 9. Known limitations
See PHASE_STATUS.md § Phase 1 → Known limitations.

## 10. Handover notes
See PHASE_STATUS.md § Handover to Phase 2.
