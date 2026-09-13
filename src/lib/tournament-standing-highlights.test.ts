import assert from "node:assert/strict";
import test from "node:test";
import { buildStandingHighlightsFromBlueprint } from "@/lib/tournament-standing-highlights";

test("uses the tournament's configured rank transitions instead of fixed European ranges", () => {
  const highlights = buildStandingHighlightsFromBlueprint(
    {
      formatBlueprintJson: {
        stageGraph: {
          mode: "VISUAL",
          stages: [
            { id: "league", name: "Европейская лига", type: "LEAGUE", divisionsCount: 1, divisions: [{ id: "main", name: "Основная", participantsCount: 16 }] },
            { id: "ucl", name: "Лига чемпионов", type: "PLAYOFF" },
            { id: "uel", name: "Лига Европы", type: "PLAYOFF" },
            { id: "uecl", name: "Лига конференций", type: "PLAYOFF" },
            { id: "extra", name: "Дополнительный этап", type: "PLAYOFF" },
          ],
          transitions: [
            { id: "ucl-range", fromStageId: "league", toStageId: "ucl", result: "RANK", fromRank: 1, toRank: 4 },
            { id: "uel-range", fromStageId: "league", toStageId: "uel", result: "RANK", fromRank: 5, toRank: 8 },
            { id: "uecl-range", fromStageId: "league", toStageId: "uecl", result: "RANK", fromRank: 9, toRank: 12 },
            { id: "extra-range", fromStageId: "league", toStageId: "extra", result: "RANK", fromRank: 15, toRank: 16 },
          ],
        },
      },
      selectedStageId: "league",
    },
  );

  assert.deepEqual(
    highlights.get(1)?.map(({ fromRank, toRank, label }) => ({ fromRank, toRank, label })),
    [
      { fromRank: 1, toRank: 4, label: "Лига чемпионов" },
      { fromRank: 5, toRank: 8, label: "Лига Европы" },
      { fromRank: 9, toRank: 12, label: "Лига конференций" },
      { fromRank: 15, toRank: 16, label: "Дополнительный этап" },
    ],
  );
});

test("uses the configured destination league name for a shared European stage", () => {
  const highlights = buildStandingHighlightsFromBlueprint({
    formatBlueprintJson: {
      stageGraph: {
        mode: "VISUAL",
        stages: [
          { id: "national", name: "Национальные лиги", type: "LEAGUE", divisionsCount: 1, divisions: [{ id: "germany", name: "Бундеслига", participantsCount: 20 }] },
          { id: "europe", name: "Еврокубки — этап лиг", type: "LEAGUE", divisionsCount: 3, divisions: [
            { id: "ucl", name: "Лига чемпионов", participantsCount: 30 },
            { id: "uel", name: "Лига Европы", participantsCount: 30 },
            { id: "uecl", name: "Лига конференций", participantsCount: 32 },
          ] },
        ],
        transitions: [
          { id: "ucl", fromStageId: "national", fromDivisionId: "germany", toStageId: "europe", toDivisionId: "ucl", result: "RANK", fromRank: 1, toRank: 6 },
          { id: "uel", fromStageId: "national", fromDivisionId: "germany", toStageId: "europe", toDivisionId: "uel", result: "RANK", fromRank: 7, toRank: 12 },
          { id: "uecl", fromStageId: "national", fromDivisionId: "germany", toStageId: "europe", toDivisionId: "uecl", result: "RANK", fromRank: 13, toRank: 18 },
        ],
      },
    },
    selectedStageId: "national",
  });

  assert.deepEqual(
    highlights.get(1)?.map(({ fromRank, toRank, label }) => ({ fromRank, toRank, label })),
    [
      { fromRank: 1, toRank: 6, label: "Лига чемпионов" },
      { fromRank: 7, toRank: 12, label: "Лига Европы" },
      { fromRank: 13, toRank: 18, label: "Лига конференций" },
    ],
  );
});
