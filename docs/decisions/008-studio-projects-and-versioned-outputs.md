# ADR 008 — Studio projects with versioned, schema-validated outputs

**Context.** Phase 1 needs save / edit / regenerate for ten different AI outputs, and Phases 2–7 need
the same pattern. Per-section tables would multiply schema work; one JSON blob per project would lose
history and validation.

**Decision.**
- Generic `projects` (typed per studio) and append-only `project_outputs` (project, section, version,
  source AI|EDIT, content JSON, state JSON, accepted flag, mock flag, link to the AI generation).
- The Zod schema of each section is the single contract: it is sent to the AI as the structured-output
  format, validates AI responses and user edits on the server, and drives the generic UI
  (`schemaToSpec` → `StructuredView` / `StructuredEditor`).
- "Active" output = accepted version, else latest; only active outputs feed later sections, exports and the
  business profile.
- Durable business facts are *promoted* from outputs into relational profile tables by an explicit user
  step (profile builder), then into the central context by approval. Outputs themselves are not the
  source of truth for other studios.

**Consequences.** New studios add a `ProjectType`, schemas and prompts, and get history, editing and UI
for free. JSON content is not queryable relationally — anything that must be queried belongs in the
profile tables. Version rows grow with regenerations (small; prune later if needed).
