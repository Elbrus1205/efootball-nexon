import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...segments: string[]) => readFileSync(path.join(root, ...segments), "utf8");

test("security page lists only recently active sessions", () => {
  const source = read("src", "app", "dashboard", "security", "page.tsx");
  assert.match(source, /const now = new Date\(\)/);
  assert.match(source, /lastActiveAt:\s*\{\s*gt:\s*getSessionActivityCutoff\(now\)/);
});

test("web regulation paragraphs use a one-centimeter first-line indent", () => {
  for (const file of [
    ["src", "app", "regulations", "page.tsx"],
    ["src", "components", "legal", "regulations-update-modal.tsx"],
    ["src", "components", "tournaments", "register-tournament-button.tsx"],
  ]) {
    assert.match(read(...file), /\[text-indent:1cm\]/, `missing regulation indent in ${file.join("/")}`);
  }
});
