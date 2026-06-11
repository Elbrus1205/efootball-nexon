/* eslint-disable no-var */
import { Prisma, PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const productionLogOptions = [{ emit: "event", level: "error" }] satisfies Prisma.PrismaClientOptions["log"];

function createPrismaClient() {
  if (process.env.NODE_ENV === "production") {
    const client = new PrismaClient<{ log: typeof productionLogOptions }>({
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
    log: ["warn", "error"],
  });
}

export const db = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = db;
