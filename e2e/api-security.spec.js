import { expect, newUser, registerViaUi, test } from "./fixtures.js";

test.describe("API security", () => {
  test("health endpoint reports database status", async ({ request }) => {
    const res = await request.get("/api/v1/health");
    expect(res.status()).toBe(200);
    expect((await res.json()).data.database).toBe("ok");
  });

  test("protected endpoints require a session", async ({ request }) => {
    const res = await request.get("/api/v1/me");
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: { code: "UNAUTHENTICATED", message: "You must be signed in." } });
  });

  test("invalid input returns 422 with field details", async ({ request }) => {
    const res = await request.post("/api/v1/auth/register", { data: { email: "bad" } });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toHaveProperty("email");
  });

  test("cross-origin state-changing requests are rejected", async ({ request }) => {
    const res = await request.post("/api/v1/auth/register", {
      data: newUser(),
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status()).toBe(403);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("users cannot read or modify another workspace's data", async ({ browser }) => {
    const ctxA = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.200.0.1" } });
    const ctxB = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.200.0.2" } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await registerViaUi(pageA, newUser());
    await registerViaUi(pageB, newUser());

    const meA = await (await pageA.request.get("/api/v1/me")).json();
    const wsA = meA.data.workspaces[0].id;
    const created = await pageA.request.post(`/api/v1/workspaces/${wsA}/businesses`, { data: { name: "Secret Co" } });
    expect(created.status()).toBe(201);
    const bizId = (await created.json()).data.id;

    const meB = await (await pageB.request.get("/api/v1/me")).json();
    const wsB = meB.data.workspaces[0].id;

    for (const [method, url] of [
      ["get", `/api/v1/workspaces/${wsA}`],
      ["get", `/api/v1/workspaces/${wsA}/businesses`],
      ["get", `/api/v1/workspaces/${wsA}/businesses/${bizId}`],
      ["get", `/api/v1/workspaces/${wsB}/businesses/${bizId}`],
      ["delete", `/api/v1/workspaces/${wsB}/businesses/${bizId}`],
    ]) {
      const res = await pageB.request[method](url);
      expect(res.status(), `${method} ${url}`).toBe(404);
    }
    const stillThere = await pageA.request.get(`/api/v1/workspaces/${wsA}/businesses/${bizId}`);
    expect((await stillThere.json()).data.name).toBe("Secret Co");

    await ctxA.close();
    await ctxB.close();
  });
});
