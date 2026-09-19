import assert from "node:assert/strict";
import test from "node:test";
import { StageType } from "@prisma/client";
import { balancedSchedulePages, scheduleDeadlineLabel, scheduleMatchCountLabel, schedulePosterFixtures, schedulePosterLayout, schedulePosterRoster, scheduleRoundTitle, type ExportScheduleMatch } from "./schedule-poster";

const home: ExportScheduleMatch = {
  id: "home", groupId: "group-a", groupName: "Группа А", matchNumber: 1,
  player1Id: "player-a", player2Id: "player-b", participant1EntryId: "entry-a", participant2EntryId: "entry-b",
  player1Name: "Kumyk", player2Name: "Nexon", player1ClubName: "Реал Мадрид", player2ClubName: "Барселона",
};
const away: ExportScheduleMatch = {
  ...home, id: "away", matchNumber: 2,
  player1Id: home.player2Id, player2Id: home.player1Id,
  participant1EntryId: home.participant2EntryId, participant2EntryId: home.participant1EntryId,
  player1Name: home.player2Name, player2Name: home.player1Name,
};

test("home/away and Best Of games show one pair, with the real number of games preserved", () => {
  const result = schedulePosterFixtures([home, away, { ...home, id: "game-3" }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].matchCount, 3);
  assert.equal(home.id, "home");
  assert.equal(result[0].player1Name, "Kumyk");
});

test("same nicknames, different group, team player pairings and replacements remain distinct", () => {
  assert.equal(schedulePosterFixtures([home, { ...home, id: "other", player1Id: "other-player" }]).length, 2);
  assert.equal(schedulePosterFixtures([home, { ...home, id: "other", participant1EntryId: "replacement" }]).length, 2);
  assert.equal(schedulePosterFixtures([home, { ...home, id: "other", groupId: "group-b" }]).length, 2);
  const pending = { ...home, player1Id: null, player2Id: null, participant1EntryId: null, participant2EntryId: null };
  assert.equal(schedulePosterFixtures([pending, { ...pending, id: "other-slot" }]).length, 2);
});

test("cancelled series and penalty tiebreaks are excluded without changing source data", () => {
  const matches = [home, away, { ...home, id: "penalty", isPenaltyTiebreak: true }, { ...home, id: "archive", status: "CANCELLED" }];
  assert.equal(schedulePosterFixtures(matches)[0].matchCount, 2);
  assert.equal(matches.length, 4);
});

test("every exported page and both columns stay balanced, including 15 and 25 fixtures", () => {
  for (const count of [0, 1, 5, 6, 7, 10, 12, 13, 15, 20, 25, 50, 100]) {
    const items = Array.from({ length: count }, (_, i) => i);
    const pages = balancedSchedulePages(items);
    assert.deepEqual(pages.flat(), items);
    if (!count) continue;
    assert.ok(Math.max(...pages.map((page) => page.length)) - Math.min(...pages.map((page) => page.length)) <= 1);
    for (const page of pages) {
      assert.ok(page.length <= 12);
      const layout = schedulePosterLayout(page.length);
      for (const slot of layout.slots) {
        assert.ok(slot.x >= 0 && slot.x + slot.width <= layout.width);
        assert.ok(slot.y >= 286 && slot.y + slot.height <= layout.height);
      }
      if (layout.columns === 2 && page.length % 2) {
        const last = layout.slots.at(-1)!;
        assert.equal(last.x + last.width / 2, layout.width / 2);
      }
    }
  }
  assert.deepEqual(balancedSchedulePages(Array.from({ length: 15 }, (_, i) => i)).map((p) => p.length), [8, 7]);
});

test("deadlines always use Moscow time and unavailable dates are explicit", () => {
  assert.equal(scheduleDeadlineLabel("2026-09-19T20:00:00Z"), "19.09.2026, 23:00 МСК");
  assert.equal(scheduleDeadlineLabel(null), "Дедлайн не назначен");
  assert.equal(scheduleDeadlineLabel("invalid"), "Дедлайн не назначен");
  assert.deepEqual([1, 2, 5, 11, 21, 24, 30].map(scheduleMatchCountLabel), ["1 матч", "2 матча", "5 матчей", "11 матчей", "21 матч", "24 матча", "30 матчей"]);
});

test("coop names use the historical lineup after replacement and current accepted roster before play", () => {
  const old = { id: "old", name: "Прежний игрок" };
  const current = { id: "new", name: "Новый игрок" };
  const lineup = [{ side: 1, user: old }, { side: 2, user: current }];
  const members = [{ status: "ACCEPTED", user: current }, { status: "PENDING", user: old }];
  assert.equal(schedulePosterRoster(1, lineup, members)?.name, old.name);
  assert.equal(schedulePosterRoster(1, [], members)?.name, current.name);
  assert.notEqual(schedulePosterRoster(1, lineup, members)?.identity, schedulePosterRoster(1, [], members)?.identity);
  assert.equal(schedulePosterRoster(1, [], []) , null);
});

test("stage labels agree in public and admin exports for groups, playoffs, bronze and super cup", () => {
  const stage = { name: "Плей-офф", type: StageType.PLAYOFF, roundsCount: 4 };
  assert.equal(scheduleRoundTitle({ round: 7 }), "7 тур");
  assert.equal(scheduleRoundTitle({ round: 1, stage }), "1/8 финала");
  assert.equal(scheduleRoundTitle({ round: 4, stage }), "Финал");
  assert.equal(scheduleRoundTitle({ round: 4, stage, isThirdPlaceMatch: true }), "Матч за 3-е место");
  assert.equal(scheduleRoundTitle({ round: 2, stage, bracket: "lower" }), "Нижняя сетка · Раунд 2");
  assert.equal(scheduleRoundTitle({ round: 1, stage: { ...stage, type: StageType.SUPER_CUP } }), "Суперкубок");
});
