/* eslint-disable no-var */
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

type PrismaClientWithErrorLog = PrismaClient<Prisma.PrismaClientOptions, "error">;

declare global {
  var prisma: PrismaClientWithErrorLog | undefined;
}

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
    if (!event.message.includes("idle-session timeout")) {
      return;
    }

    db.$disconnect().catch(() => null);
  });
}

if (process.env.NODE_ENV !== "production") global.prisma = db;
