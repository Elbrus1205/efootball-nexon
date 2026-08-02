import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...segments: string[]) => readFileSync(path.join(root, ...segments), "utf8");

test("participant cache exposes public profile ids for registrations and roster members", () => {
  const cache = read("src", "lib", "tournament-cache.ts");

  assert.match(cache, /rosterMembers:[\s\S]*?user:\s*\{\s*select:\s*\{[^}]*publicId:\s*true/);
  assert.match(cache, /user:\s*\{\s*select:\s*\{[^}]*publicId:\s*true[^}]*telegramUsername:\s*true/);
});

test("participant nicknames link to public profiles in single and roster tournaments", () => {
  const page = read("src", "app", "tournaments", "[id]", "page.tsx");

  assert.match(page, /playerId=\{entry\.user\.publicId\}/);
  assert.match(page, /href=\{`\/players\/\$\{member\.user\.publicId\}`\}/);
});
