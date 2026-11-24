/**
 * Free, zero-setup storage: bytes live in MySQL (`storage_objects`).
 * Intended for small brand files; switch STORAGE_PROVIDER to s3 at scale.
 * Not the application filesystem, so it is safe on serverless platforms.
 */
export const DATABASE_MAX_FILE_BYTES = 5 * 1024 * 1024;

export function createDatabaseAdapter(prisma) {
  return {
    name: "database",
    bucket: "mysql",
    maxFileBytes: DATABASE_MAX_FILE_BYTES,
    async put(key, body, { contentType }) {
      const data = Buffer.from(body);
      await prisma.storageObject.upsert({
        where: { objectKey: key },
        create: { objectKey: key, contentType, sizeBytes: data.length, data },
        update: { contentType, sizeBytes: data.length, data },
      });
    },
    async get(key) {
      const row = await prisma.storageObject.findUnique({ where: { objectKey: key } });
      return row ? { body: Buffer.from(row.data), contentType: row.contentType } : null;
    },
    async delete(key) {
      await prisma.storageObject.deleteMany({ where: { objectKey: key } });
    },
    // Served through the authenticated download route instead of a public URL.
    async signedUrl() {
      return null;
    },
  };
}
