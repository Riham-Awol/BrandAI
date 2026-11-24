/**
 * Deterministic sample outputs used ONLY by the mock text provider
 * (AI_TEXT_PROVIDER=mock, refused in production). Modules register one
 * fixture per task so end-to-end tests can exercise real UI flows.
 * Every result produced from here is stored with isMock=true and labelled in the UI.
 */
const fixtures = new Map();

export function registerMockFixture(module, task, factory) {
  fixtures.set(`${module}:${task}`, factory);
}

export function mockFixtureResponder(request) {
  const factory = fixtures.get(`${request.module}:${request.task}`);
  if (!factory) return { text: "[mock output]", data: null };
  return { data: factory(request) };
}
