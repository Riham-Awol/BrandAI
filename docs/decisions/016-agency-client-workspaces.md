# ADR 016 — Agency clients as separate workspaces

**Context.** Agencies manage several client businesses and may invite client contacts. All tenant isolation is
by workspace; per-business permissions would touch every module.

**Decision.** Each client is a separate workspace linked to the agency (`workspaces.agency_workspace_id`,
`agency_clients` row), owned by the agency's owner. It uses the agency's plan and AI credits; the agency's admins
and editors can be added with one click; client contacts are invited into the client's workspace only.
Archiving a client suspends its workspace.

**Consequences.** Full isolation between clients with no change to existing modules or queries. Switching
between clients uses the normal workspace switcher. Cross-client reporting is per workspace (agency overview lists
usage per client).
