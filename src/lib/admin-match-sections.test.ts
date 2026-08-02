import { StageType } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminMatchSections } from "./admin-match-sections";

test("separates a league tour from a playoff round with the same number", () => {
  const sections = buildAdminMatchSections([
    {
      id: "league-match",
      round: 1,
      matchNumber: 1,
      stageId: "league-stage",
      stage: { id: "league-stage", name: "Лига", type: StageType.LEAGUE, orderIndex: 1 },
    },
    {
      id: "playoff-match",
      round: 1,
      matchNumber: 1,
      stageId: "playoff-stage",
      stage: { id: "playoff-stage", name: "Плей-офф", type: StageType.PLAYOFF, orderIndex: 2 },
    },
  ]);

  assert.deepEqual(
    sections.map((section) => ({ label: section.label, matchIds: section.matches.map((match) => match.id) })),
    [
      { label: "Лига · Тур 1", matchIds: ["league-match"] },
      { label: "Плей-офф · Раунд 1", matchIds: ["playoff-match"] },
    ],
  );
});
