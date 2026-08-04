import { StageType } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { adminMatchSectionKey } from "./admin-match-sections";
import { mergeAdminMatchSaveResult } from "./admin-match-editor-state";

const formats = [
  { label: "1x1", stageId: null, stage: null, group: null },
  {
    label: "group",
    stageId: "group-stage",
    stage: { id: "group-stage", name: "Группы", type: StageType.GROUP_STAGE, orderIndex: 1 },
    group: { name: "A" },
  },
  {
    label: "playoff",
    stageId: "playoff-stage",
    stage: { id: "playoff-stage", name: "Плей-офф", type: StageType.PLAYOFF, orderIndex: 2 },
    group: null,
  },
] as const;

for (const format of formats) {
  test(`${format.label}: out-of-order score saves keep both entered scores and the visible section`, () => {
    const initial = {
      id: `${format.label}-match`,
      round: 1,
      matchNumber: 1,
      ...format,
      player1Score: null as number | null,
      player2Score: null as number | null,
    };
    const sectionBefore = adminMatchSectionKey(initial);

    const afterSecondField = mergeAdminMatchSaveResult(
      initial,
      { player2Score: 1 },
      { ...initial, player1Score: 2, player2Score: 1 },
    );
    const afterLateFirstField = mergeAdminMatchSaveResult(
      afterSecondField,
      { player1Score: 2 },
      { ...initial, player1Score: 2, player2Score: null },
    );

    assert.deepEqual([afterLateFirstField.player1Score, afterLateFirstField.player2Score], [2, 1]);
    assert.equal(adminMatchSectionKey(afterLateFirstField), sectionBefore);
  });
}

test("team match: saving a score preserves the assigned player used by the active search", () => {
  const initial = {
    id: "team-match",
    round: 1,
    matchNumber: 1,
    stageId: "team-playoff",
    stage: { id: "team-playoff", name: "Командный плей-офф", type: StageType.PLAYOFF, orderIndex: 1 },
    group: null,
    participant1EntryId: "team-entry",
    participant1Entry: { clubName: "Arsenal", clubSlug: "arsenal" },
    player1Id: "assigned-player",
    player1: { name: "Назначенный игрок" },
    player1Score: null as number | null,
    player2Score: null as number | null,
  };

  const updated = mergeAdminMatchSaveResult(initial, { player1Score: 3 }, {
    ...initial,
    player1Score: 3,
    participant1EntryId: "team-entry",
    player1Id: "assigned-player",
    player1: undefined,
    participant1Entry: undefined,
  });

  assert.equal(updated.player1.name, "Назначенный игрок");
  assert.equal(updated.participant1Entry.clubName, "Arsenal");
  assert.equal(updated.player1Score, 3);
});
