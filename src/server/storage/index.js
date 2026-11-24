import "server-only";
import { getEnv } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { createDatabaseAdapter } from "./database-adapter.js";
import { Errors } from "../errors.js";
import { createMemoryAdapter } from "./memory-adapter.js";
import { createS3Adapter } from "./s3-adapter.js";

let adapter;

/**
 * Returns the configured storage adapter. The application filesystem is never
 * used for permanent user assets.
 */
export function getStorage() {
  if (adapter) return adapter;
  const env = getEnv();
  if (env.STORAGE_PROVIDER === "s3") {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) throw Errors.notConfigured("File storage (S3 credentials missing)");
    adapter = createS3Adapter({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    });
  } else if (env.STORAGE_PROVIDER === "database") {
    adapter = createDatabaseAdapter(prisma);
  } else if (env.STORAGE_PROVIDER === "memory") {
    if (env.APP_ENV === "production") throw Errors.notConfigured("File storage");
    adapter = createMemoryAdapter();
  } else {
    throw Errors.notConfigured("File storage");
  }
  return adapter;
}

export function setStorageAdapter(next) {
  adapter = next;
}
