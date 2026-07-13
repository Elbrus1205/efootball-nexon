import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./register-tournament-button.tsx", import.meta.url), "utf8");
const tournamentPage = readFileSync(new URL("../../app/tournaments/[id]/page.tsx", import.meta.url), "utf8");

test("renders registration dialogs at the document level with mobile-safe positioning", () => {
  assert.match(source, /createPortal/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /items-end[^\"]*sm:items-center/);
  assert.match(source, /env\(safe-area-inset-bottom\)/);
});

test("uses one prominent registration action without restoring the old mobile card", () => {
  assert.match(source, /UserPlus/);
  assert.match(source, /Участвовать в турнире/);
  assert.match(tournamentPage, /md:hidden[^>]*>[\s\S]{0,180}\{primaryAction\}/);
  assert.doesNotMatch(tournamentPage, /md:hidden[^>]*>[\s\S]{0,180}<Card/);
});

test("keeps club selection compact and prevents content overflow", () => {
  assert.match(source, /min-w-0[^\"]*overflow-hidden/);
  assert.match(source, /overflow-y-auto[^\"]*overscroll-contain/);
  assert.match(source, /aria-pressed=\{selected\}/);
});
