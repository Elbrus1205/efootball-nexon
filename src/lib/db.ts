/* eslint-disable no-var */
import { Prisma, PrismaClient } from "@prisma/client";
import { configureRuntimeDatabaseUrl } from "@/lib/database-url";

declare global {
  var prisma: PrismaClient | undefined;
}

const productionLogOptions = [{ emit: "event", level: "error" }] satisfies Prisma.PrismaClientOptions["log"];

function getDatabaseUrlWithPoolDefaults() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  return configureRuntimeDatabaseUrl(databaseUrl, {
    connectionLimit: process.env.PRISMA_CONNECTION_LIMIT,
    poolTimeout: process.env.PRISMA_POOL_TIMEOUT,
  });
}

function createPrismaClient() {
  const databaseUrl = getDatabaseUrlWithPoolDefaults();
  const datasources = databaseUrl ? { db: { url: databaseUrl } } : undefined;

  if (process.env.NODE_ENV === "production") {
    const client = new PrismaClient({
      ...(datasources ? { datasources } : {}),
      log: productionLogOptions,
    });

    client.$on("error", (event) => {
      if (event.message.includes("idle-session timeout") || event.message.includes("SqlState(E57P05)")) {
        return;
      }

      console.error("prisma:error", event.message);
    });

    return client;
  }

  return new PrismaClient({
    ...(datasources ? { datasources } : {}),
    log: ["warn", "error"],
  });
}

export const db = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = db;
