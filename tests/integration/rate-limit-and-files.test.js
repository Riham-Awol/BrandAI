import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma.js";
import { createDatabaseStore } from "@/server/rate-limit/database-store.js";
import { createRateLimiter } from "@/server/rate-limit/limiter.js";
import { createMemoryAdapter } from "@/server/storage/memory-adapter.js";
import { setStorageAdapter } from "@/server/storage/index.js";
import { deleteFile, getFileDownloadUrl, uploadFile } from "@/server/storage/files-service.js";
import { getUsageSummary } from "@/server/usage/service.js";
import { createUser } from "../helpers/factories.js";

describe("database rate limit store", () => {
  it("counts concurrent hits atomically across callers", async () => {
    const limiter = createRateLimiter(createDatabaseStore(prisma));
    const policy = { limit: 5, windowMs: 60_000 };
    const results = await Promise.all(Array.from({ length: 8 }, () => limiter.check("concurrency-test", policy)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect((await prisma.rateLimitBucket.findUnique({ where: { key: "concurrency-test" } })).count).toBe(8);
  });

  it("starts a new window after expiry", async () => {
    const store = createDatabaseStore(prisma);
    await store.hit("expiry-test", 1, Date.now() - 10_000);
    const fresh = await store.hit("expiry-test", 60_000);
    expect(fresh.count).toBe(1);
  });
});

describe("file storage service", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);

  it("stores files under the workspace prefix and tracks storage usage", async () => {
    const adapter = createMemoryAdapter();
    setStorageAdapter(adapter);
    const { user, workspace } = await createUser();
    const file = await uploadFile(user, workspace.id, { buffer: png, originalName: "../logo.png", purpose: "brand-asset" });
    expect(file).toMatchObject({ mimeType: "image/png", sizeBytes: 108, originalName: "logo.png" });
    const row = await prisma.storedFile.findUnique({ where: { id: file.id } });
    expect(row.objectKey.startsWith(`workspaces/${workspace.id}/brand-asset/`)).toBe(true);
    expect(adapter.objects.has(row.objectKey)).toBe(true);

    const usage = await getUsageSummary(user, workspace.id);
    expect(usage.find((u) => u.metric === "STORAGE_BYTES").used).toBe("108");
  });

  it("rejects disallowed types and isolates files between workspaces", async () => {
    setStorageAdapter(createMemoryAdapter());
    const a = await createUser();
    const b = await createUser();
    await expect(uploadFile(a.user, a.workspace.id, { buffer: Buffer.from("<svg/>"), originalName: "x.svg", purpose: "brand-asset" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const file = await uploadFile(a.user, a.workspace.id, { buffer: png, originalName: "a.png", purpose: "brand-asset" });
    await expect(getFileDownloadUrl(b.user, b.workspace.id, file.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteFile(b.user, b.workspace.id, file.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await deleteFile(a.user, a.workspace.id, file.id);
    expect((await prisma.storedFile.findUnique({ where: { id: file.id } })).deletedAt).not.toBeNull();
  });
});
