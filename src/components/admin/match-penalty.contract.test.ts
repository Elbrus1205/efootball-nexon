import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");

test("the match editor can send the same reliability penalty to both players", () => {
  const component = read("src", "components", "admin", "match-manager.tsx");
  const validator = read("src", "lib", "validators.ts");
  const route = read("src", "app", "api", "admin", "matches", "[id]", "route.ts");

  assert.match(component, /Обоим игрокам/);
  assert.match(component, /reliabilityPenaltyUserIds/);
  assert.match(validator, /reliabilityPenaltyUserIds:\s*z\.array/);
  assert.match(route, /getMatchPenaltyTargetUserIds/);
});

test("the new message misconduct penalty deducts six points", () => {
  const migration = read(
    "prisma",
    "migrations",
    "20260719143000_add_message_misconduct_penalty",
    "migration.sql",
  );

  assert.match(migration, /Мат, оскорбления и непристойное поведение/);
  assert.match(migration, /6, 'SCORE_SUBMISSION'/);
});

test("the regulation update documents the penalty and forces a new acceptance version", () => {
  const migration = read(
    "prisma",
    "migrations",
    "20260719143000_add_message_misconduct_penalty",
    "migration.sql",
  );
  const regulations = read("src", "lib", "regulations.ts");

  assert.match(migration, /regulations_previous/);
  assert.match(migration, /Штраф за сообщения/);
  assert.match(migration, /минус 6 баллов надежности/);
  assert.match(regulations, /default-2026-07-19-message-misconduct/);
  assert.match(regulations, /минус 6 баллов надежности/);
});
