import assert from "node:assert/strict";
import test from "node:test";
import { MatchStatus, ParticipantStatus, StageType } from "@prisma/client";
import { buildExportTables, standingsPosterPages, type ExportGroup } from "./standings-poster";
import { adminScheduleSection, balancedSchedulePages, schedulePosterCapacity, schedulePosterLayout } from "./schedule-poster";

const participant = (id: string) => ({ id, userId: id, clubSlug: null, clubName: id, clubBadgePath: null, user: { id, name: id }, status: ParticipantStatus.CONFIRMED });
const stage = (id: string, type: StageType = StageType.LEAGUE) => ({ id, name: id, type, entries: [] as { registrationId: string; groupId: string | null }[], groups: [] as { id: string; name: string; members: ReturnType<typeof participant>[] }[] });

test("exports every group stage and keeps leagues with identical names separate", () => {
  const stages = [stage("first", "GROUP_STAGE"), stage("second", "GROUP_STAGE"), stage("league-a"), stage("league-b"), stage("cup", "PLAYOFF")];
  stages[0].groups = [{ id: "ga", name: "A", members: [participant("a")] }];
  stages[1].groups = [{ id: "gb", name: "A", members: [participant("b")] }];
  stages[2].name = stages[3].name = "Лига";
  stages[2].entries = [{ registrationId: "c", groupId: null }];
  stages[3].entries = [{ registrationId: "d", groupId: null }];
  const tables = buildExportTables(stages, ["a", "b", "c", "d", "unassigned"].map(participant), [], new Map());
  assert.deepEqual(tables.map((table) => table.id), ["ga", "gb", "league-a", "league-b"]);
  assert.deepEqual(tables.map((table) => table.rows.map((row) => row.playerName)), [["a"], ["b"], ["c"], ["d"]]);
  assert.deepEqual(tables.map((table) => table.kind), ["groups", "groups", "leagues", "leagues"]);
});

test("uses stage scoring, confirmed entry results and replacement chains without mutating registrations", () => {
  const league = { ...stage("league"), pointsForWin: 5, entries: [{ registrationId: "new", groupId: null }, { registrationId: "b", groupId: null }] };
  const participants = [{ ...participant("old"), status: ParticipantStatus.REMOVED, notes: "replacementRegistrationId:new" }, participant("new"), participant("b"), participant("unassigned")];
  const match = { stageId: "league", groupId: null, participant1EntryId: "old", participant2EntryId: "b", player1Id: "old", player2Id: "b", player1Score: 3, player2Score: 1, status: MatchStatus.CONFIRMED };
  const tables = buildExportTables([league], participants, [match, { ...match, excludeFromTournamentStandings: true }, { ...match, status: MatchStatus.CANCELLED }], new Map());
  assert.deepEqual(tables[0].rows.map((row) => [row.playerName, row.points, row.played, row.rank]), [["new", 5, 1, 1], ["b", 0, 1, 2]]);
  assert.equal(participants[0].status, ParticipantStatus.REMOVED);
});

test("league without stage entries uses only its matches; empty league remains empty", () => {
  const match = { stageId: "one", groupId: null, participant1EntryId: "a", participant2EntryId: "b", player1Id: null, player2Id: null, player1Score: null, player2Score: null };
  const tables = buildExportTables([stage("one"), stage("two")], ["a", "b", "c"].map(participant), [match], new Map());
  assert.equal(tables[0].rows.length, 2);
  assert.equal(tables[1].rows.length, 0);
});

test("large tables keep every participant and continuous ranks across separate square pages", () => {
  for (const count of [0, 1, 12, 13, 25, 64, 100]) {
    const table: ExportGroup = { id: "a", name: "A", stageName: "League", kind: "leagues", rows: Array.from({ length: count }, (_, index) => ({ id: String(index), rank: index + 1, clubName: "Club", playerName: "Player", played: 0, wins: 0, draws: 0, losses: 0, goalDifference: 0, points: 0 })) };
    const pages = standingsPosterPages([table, { ...table, id: "b" }]);
    assert.deepEqual(pages.filter((page) => page.table.id === "a").flatMap((page) => page.rows), table.rows);
    assert.ok(pages.every((page) => page.rows.length <= 12));
    assert.equal(pages.at(-1)?.page, Math.max(1, Math.ceil(count / 12)));
  }
});

test("square and landscape schedule pages retain every fixture within their fixed aspect ratio", () => {
  for (const format of ["square", "landscape"] as const) {
    for (const count of [1, 2, 3, 5, 6, 7, 12, 13, 25, 64, 100]) {
      const items = Array.from({ length: count }, (_, index) => index);
      const pages = balancedSchedulePages(items, schedulePosterCapacity(format));
      assert.deepEqual(pages.flat(), items);
      for (const page of pages) {
        const layout = schedulePosterLayout(page.length, format);
        assert.equal(layout.width / layout.height, format === "square" ? 1 : 16 / 9);
        for (const slot of layout.slots) {
          assert.ok(slot.height >= 170);
          assert.ok(slot.y >= 340 && slot.y + slot.height <= layout.height - 99);
          assert.ok(slot.x >= 64 && slot.x + slot.width <= layout.width - 64);
        }
      }
    }
  }
});

test("same-named leagues, groups and playoff brackets never share a schedule page", () => {
  const match = { stageId: "one", groupId: "group-a", bracketId: null, round: 1, bracket: "upper", isThirdPlaceMatch: false, stage: { name: "Этап", type: StageType.LEAGUE }, group: { name: "Лига" } };
  const variants = [match, { ...match, stageId: "two" }, { ...match, groupId: "group-b" }, { ...match, bracketId: "bracket-a" }, { ...match, bracketId: "bracket-b" }, { ...match, bracket: "lower" }, { ...match, isThirdPlaceMatch: true }];
  assert.equal(new Set(variants.map((item) => adminScheduleSection(item).key)).size, variants.length);
  assert.equal(adminScheduleSection(match).format, "square");
  for (const type of [StageType.PLAYOFF, StageType.SUPER_CUP]) {
    const section = adminScheduleSection({ ...match, stage: { name: "Кубок", type } });
    assert.equal(section.format, "landscape");
    assert.equal(section.kind, "playoffs");
  }
});
