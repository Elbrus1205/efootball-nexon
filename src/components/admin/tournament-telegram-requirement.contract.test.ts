import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");

test("tournament builder does not expose an optional Telegram requirement", () => {
  const builder = read("src", "components", "admin", "tournament-builder-form.tsx");
  assert.doesNotMatch(builder, /requireTelegramForRegistration/);
  assert.doesNotMatch(builder, /Требовать привязанный Telegram/);
});

test("create and update persist the permanent Telegram requirement", () => {
  const createRoute = read("src", "app", "api", "admin", "tournaments", "route.ts");
  const updateRoute = read("src", "app", "api", "admin", "tournaments", "[id]", "update", "route.ts");
  assert.match(createRoute, /requireTelegramForRegistration: true/);
  assert.match(updateRoute, /requireTelegramForRegistration: true/);
});

test("the Prisma schema makes Telegram required for tournaments", () => {
  const schema = read("prisma", "schema.prisma");
  assert.match(schema, /requireTelegramForRegistration\s+Boolean\s+@default\(true\)/);
});
