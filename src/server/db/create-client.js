import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Converts a mysql:// connection URL into a MariaDB connector pool config.
 * The MariaDB connector is Prisma's supported driver adapter for MySQL 8.
 */
export function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }
  const url = new URL(databaseUrl);
  if (!["mysql:", "mariadb:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use the mysql:// protocol.");
  }
  const params = url.searchParams;
  const config = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: Number(params.get("connection_limit") ?? 5),
    // Required for MySQL 8 caching_sha2_password over non-TLS local connections.
    allowPublicKeyRetrieval: params.get("allowPublicKeyRetrieval") !== "false",
  };
  const sslaccept = params.get("sslaccept") ?? params.get("ssl-mode");
  if (sslaccept && sslaccept !== "disabled") {
    config.ssl = { rejectUnauthorized: sslaccept !== "accept_invalid_certs" };
  }
  return config;
}

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  const adapter = new PrismaMariaDb(parseDatabaseUrl(databaseUrl));
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}
