import { registerMockFixture } from "../ai/providers/mock-fixtures.js";

/** Test-only mock output for the admin AI health check (plain text task). */
registerMockFixture("admin", "health", () => "OK");
