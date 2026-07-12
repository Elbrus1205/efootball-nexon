import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./tournament-schedule-view.tsx", import.meta.url), "utf8");

test("keeps schedule matchups aligned across mobile and desktop layouts", () => {
  assert.match(source, /grid-cols-\[minmax\(0,1fr\)_3\.5rem_minmax\(0,1fr\)\]/);
  assert.match(source, /lg:grid-cols-2/);
  assert.doesNotMatch(source, /grid-cols-1 items-center gap-3 sm:grid-cols/);
});

test("allows deadline status to use the full mobile card width", () => {
  assert.match(source, /w-full justify-center sm:w-auto/);
});
