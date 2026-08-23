import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const formSource = readFileSync(new URL("./tournament-builder-form.tsx", import.meta.url), "utf8");
const formatSource = readFileSync(new URL("./format-blueprint-builder.tsx", import.meta.url), "utf8");
const stageGraphSource = readFileSync(new URL("./stage-graph-editor.tsx", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("./tournament-builder-ui.tsx", import.meta.url), "utf8");

test("redesigned tournament builder keeps the complete server submission contract", () => {
  const fieldNames = [
    "title",
    "status",
    "format",
    "startsAt",
    "maxParticipants",
    "participantMode",
    "rosterSize",
    "matchupFormat",
    "bestOfWins",
    "isTest",
    "prizePool",
    "coverImage",
    "lineupPhotoExampleUrl",
    "formatBlueprintJson",
    "seedingMethod",
    "pointsForWin",
    "pointsForDraw",
    "pointsForLoss",
    "autoCreateMatches",
    "autoCreateSchedule",
    "autoOpenRegistration",
    "autoAdvanceFromGroups",
    "manualBracketControl",
    "manualPlayoffSelection",
    "checkInRequired",
    "requireLineupPhoto",
    "telegramCommunityId",
    "telegramChannelId",
    "telegramGroupId",
    "telegramAutoPublish",
    "clubSelectionMode",
    "sortRules",
  ];

  for (const fieldName of fieldNames) {
    assert.ok(formSource.includes(`name="${fieldName}"`), `missing form field: ${fieldName}`);
  }
  assert.match(formatSource, /name=\{name\} value=\{stringifyFormatBlueprint\(blueprint\)\}/);
});

test("builder exposes responsive section navigation and one safe draft intent", () => {
  for (const sectionId of ["overview", "participants", "structure", "matches", "media"]) {
    assert.ok(formSource.includes(`id="${sectionId}"`), `missing builder section: ${sectionId}`);
    assert.ok(formSource.includes(`href: "#${sectionId}"`), `missing builder navigation item: ${sectionId}`);
  }

  assert.doesNotMatch(formSource, /id="telegram"|href: "#telegram"|Telegram турнира/);

  assert.match(formSource, /data-intent="draft"/);
  assert.match(formSource, /elements\.namedItem\("status"\)/);
  assert.doesNotMatch(formSource, /name="status" value=\{TournamentStatus\.DRAFT\}/);
});

test("failed creation restores the session draft instead of clearing a large graph", () => {
  assert.match(formSource, /TOURNAMENT_BUILDER_DRAFT_KEY/);
  assert.match(formSource, /window\.sessionStorage\.setItem/);
  assert.match(formSource, /restoredDraft=\{restoredDraft\}/);
  assert.match(formSource, /persistCreationDraft\(\);/);
});

test("shared builder controls keep accessible touch and focus states", () => {
  assert.match(uiSource, /h-12/);
  assert.match(uiSource, /min-h-16/);
  assert.match(uiSource, /focus-visible:ring-2/);
  assert.match(uiSource, /type="radio"/);
  assert.match(uiSource, /type="checkbox"/);
  assert.match(formSource, /role="alert"/);
  assert.match(stageGraphSource, /aria-label=\{`Удалить этап/);
  assert.match(stageGraphSource, /aria-label="Удалить переход"/);
});

test("structure builder exposes only the visual stage graph", () => {
  assert.match(formatSource, /<StageGraphEditor/);
  assert.match(formatSource, /mode: "VISUAL"/);
  assert.doesNotMatch(formatSource, /Быстрая настройка|structureMode|selectStructureMode/);
});
