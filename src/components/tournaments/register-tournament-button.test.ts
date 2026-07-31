import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./register-tournament-button.tsx", import.meta.url), "utf8");
const tournamentPage = readFileSync(new URL("../../app/tournaments/[id]/page.tsx", import.meta.url), "utf8");
const builderSource = readFileSync(new URL("../admin/tournament-builder-form.tsx", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");

test("renders registration dialogs at the document level with mobile-safe positioning", () => {
  assert.match(source, /createPortal/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /items-center[^\"]*justify-center/);
  assert.doesNotMatch(source, /items-end/);
  assert.match(source, /env\(safe-area-inset-bottom\)/);
});

test("separates team creation from club selection in team tournaments", () => {
  assert.match(source, /teamCreationModal/);
  assert.match(source, /team-name-input/);
  assert.match(source, /Создать команду/);
  assert.match(source, /Выберите клуб команды/);

  const teamCreationPosition = source.indexOf("Создать команду");
  const clubSelectionPosition = source.indexOf("Выберите клуб команды");
  assert.ok(teamCreationPosition >= 0, "team creation dialog must be rendered");
  assert.ok(clubSelectionPosition > teamCreationPosition, "club selection must come after team creation");
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

test("shows the admin-configured lineup example before a compact file picker", () => {
  assert.match(schemaSource, /lineupPhotoExampleUrl\s+String\?/);
  assert.match(builderSource, /name="lineupPhotoExampleUrl"/);
  assert.match(tournamentPage, /lineupPhotoExampleUrl=\{tournament\.lineupPhotoExampleUrl\}/);
  assert.match(source, /lineupPhotoExampleUrl\?: string/);

  const examplePosition = source.indexOf("Пример правильного фото состава");
  const pickerPosition = source.indexOf("Выбрать файл");
  assert.ok(examplePosition >= 0, "lineup example must be visible in the registration dialog");
  assert.ok(pickerPosition > examplePosition, "file picker must be rendered below the lineup example");
  assert.doesNotMatch(source, /min-h-44 cursor-pointer/);
});
