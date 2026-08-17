import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const updateRouteSource = readFileSync("src/app/api/admin/tournaments/[id]/update/route.ts", "utf8");
const editPageSource = readFileSync("src/app/admin/tournaments/[id]/edit/page.tsx", "utf8");

test("editing a tournament synchronizes derived stages and invalidates every public cache slice", () => {
  assert.match(updateRouteSource, /synchronizeTournamentAfterEdit/);
  assert.match(updateRouteSource, /assertTournamentEditAllowed/);
  assert.match(updateRouteSource, /invalidateTournamentAll\(updated\.id\)/);
  assert.doesNotMatch(updateRouteSource, /invalidateTournamentRules\(updated\.id\)/);
});

test("a rejected structural edit returns to the form with an accessible explanation", () => {
  assert.match(updateRouteSource, /redirectUrl\.searchParams\.set\("error", message\)/);
  assert.match(editPageSource, /role="alert"/);
  assert.match(editPageSource, /searchParams\?\.error/);
});

test("structural safety is checked before the canonical tournament row is updated", () => {
  const assertionIndex = updateRouteSource.indexOf("await assertTournamentEditAllowed");
  const updateIndex = updateRouteSource.indexOf("const updated = await db.tournament.update");
  assert.ok(assertionIndex >= 0);
  assert.ok(updateIndex > assertionIndex);
});

test("a synchronization failure rolls back canonical structural settings and returns to the editor", () => {
  assert.match(updateRouteSource, /Настройки структуры возвращены к предыдущим значениям/);
  assert.match(updateRouteSource, /invalidateTournamentAll\(updated\.id\)/);
  assert.doesNotMatch(updateRouteSource, /catch \(error\) \{[\s\S]{0,900}throw error;/);
});
