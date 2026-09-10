import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as sessionActivity from "./session-activity";

test("an expired security session cannot authenticate even while its JWT is valid", async () => {
  let touched = false;
  const dependencies: Record<string, unknown> = {
    "@auth/prisma-adapter": { PrismaAdapter: () => ({}) },
    "@/lib/auth/session-activity": sessionActivity,
    "@/lib/auth/security": { touchSecuritySession: async () => { touched = true; } },
    "@/lib/db": { db: { securitySession: { findUnique: async () => ({
      userId: "user", revokedAt: null, lastActiveAt: new Date(0), expiresAt: new Date(1), user: { id: "user", isBanned: false },
    }) } } },
  };
  const exported: { authOptions?: { callbacks: { jwt: (args: { token: { sub: string; authSessionId: string } }) => Promise<object> } } } = {};
  const source = readFileSync("src/lib/auth/options.ts", "utf8");
  new Function("require", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(
    (name: string) => dependencies[name] ?? new Proxy({}, { get: () => () => ({}) }), exported,
  );
  assert.deepEqual(await exported.authOptions!.callbacks.jwt({ token: { sub: "user", authSessionId: "session" } }), {});
  assert.equal(touched, false);
});

test("a legacy JWT without a recorded login cannot create an active session", async () => {
  let queried = false;
  const dependencies: Record<string, unknown> = {
    "@auth/prisma-adapter": { PrismaAdapter: () => ({}) },
    "@/lib/auth/session-activity": sessionActivity,
    "@/lib/db": { db: { securitySession: { findUnique: async () => { queried = true; return null; } } } },
  };
  const exported: { authOptions?: { callbacks: { jwt: (args: { token: { sub: string } }) => Promise<object> } } } = {};
  const source = readFileSync("src/lib/auth/options.ts", "utf8");
  new Function("require", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(
    (name: string) => dependencies[name] ?? new Proxy({}, { get: () => () => ({}) }), exported,
  );
  assert.deepEqual(await exported.authOptions!.callbacks.jwt({ token: { sub: "user" } }), {});
  assert.equal(queried, false);
});

test("security session expiry matches the configured JWT lifetime", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  assert.equal(sessionActivity.getSessionExpiry(now).getTime() - now.getTime(), sessionActivity.AUTH_SESSION_MAX_AGE_SECONDS * 1000);
});

test("signing in again replaces the old browser session and keeps another device", async () => {
  type Session = { userId: string; authSessionId: string; expiresAt: Date; revokedAt: Date | null };
  const sessions: Session[] = [
    { userId: "user", authSessionId: "old-browser", expiresAt: sessionActivity.getSessionExpiry(), revokedAt: null },
    { userId: "user", authSessionId: "other-device", expiresAt: sessionActivity.getSessionExpiry(), revokedAt: null },
    { userId: "user", authSessionId: "expired", expiresAt: new Date(0), revokedAt: null },
  ];
  const table = {
    deleteMany: async ({ where }: { where: { userId: string; authSessionId?: string; OR?: unknown[] } }) => {
      for (let index = sessions.length - 1; index >= 0; index--) {
        const item = sessions[index];
        if (item.userId === where.userId && (where.OR ? item.expiresAt <= new Date() || item.revokedAt : item.authSessionId === where.authSessionId)) sessions.splice(index, 1);
      }
    },
    create: async ({ data }: { data: Session }) => { sessions.push(data); },
  };
  const dependencies: Record<string, unknown> = {
    "@/lib/auth/session-activity": sessionActivity,
    "@/lib/db": { db: { securitySession: table, $transaction: async (callback: (tx: { securitySession: typeof table }) => Promise<unknown>) => callback({ securitySession: table }) } },
  };
  const exported: { createSecuritySession?: (args: object) => Promise<unknown> } = {};
  new Function("require", "exports", ts.transpileModule(readFileSync("src/lib/auth/security.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(
    (name: string) => dependencies[name] ?? {}, exported,
  );
  await exported.createSecuritySession!({ userId: "user", authSessionId: "new-browser", previousSession: { userId: "user", authSessionId: "old-browser" }, context: {} });
  assert.deepEqual(sessions.map(item => item.authSessionId).sort(), ["new-browser", "other-device"]);
});
