/* eslint-disable no-var */
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

type PrismaClientWithErrorLog = PrismaClient<Prisma.PrismaClientOptions, "error">;

declare global {
  var prisma: PrismaClientWithErrorLog | undefined;
}

function appendPostgresOption(currentOptions: string | null, option: string) {
  const options = currentOptions?.trim();
  if (!options) return option;
  if (options.includes(option)) return options;
  return `${options} ${option}`;
}

function preparePostgresOptions() {
  process.env.PGOPTIONS = appendPostgresOption(process.env.PGOPTIONS ?? null, "-c idle_session_timeout=0");
}

function prepareDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return;

  try {
    const url = new URL(rawUrl);
    if (!url.protocol.startsWith("postgres")) return;

    url.searchParams.set("connect_timeout", url.searchParams.get("connect_timeout") ?? "10");
    url.searchParams.set("pool_timeout", url.searchParams.get("pool_timeout") ?? "10");
    url.searchParams.set("connection_limit", url.searchParams.get("connection_limit") ?? "3");
    url.searchParams.set(
      "options",
      appendPostgresOption(url.searchParams.get("options"), "-c idle_session_timeout=0"),
    );

    process.env.DATABASE_URL = url.toString();
  } catch {
    // Prisma will report the original connection error with its normal diagnostics.
  }
}

preparePostgresOptions();
prepareDatabaseUrl();

const prismaLog: Prisma.LogDefinition[] =
  process.env.NODE_ENV === "development"
    ? [
        { emit: "stdout", level: "warn" },
        { emit: "event", level: "error" },
      ]
    : [{ emit: "event", level: "error" }];

export const db =
  global.prisma ??
  (new PrismaClient({
    log: prismaLog,
  }) as PrismaClientWithErrorLog);

if (process.env.NODE_ENV === "production") {
  db.$on("error", (event) => {
    console.error(event.message);
  });

  const keepAliveInterval = setInterval(() => {
    db.$queryRaw`SELECT 1`.catch((error) => {
      console.error("[prisma-keepalive]", error instanceof Error ? error.message : error);
    });
  }, 30_000);
  keepAliveInterval.unref?.();

  const disconnect = () => {
    clearInterval(keepAliveInterval);
    db.$disconnect().catch(() => null);
  };

  process.once("SIGTERM", disconnect);
  process.once("SIGINT", disconnect);
}

if (process.env.NODE_ENV !== "production") global.prisma = db;
