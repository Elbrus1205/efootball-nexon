import assert from "node:assert/strict";
import test from "node:test";
import { MatchStatus } from "@prisma/client";
import {
  buildRandomCaptainTeamAssignments,
  collectCaptainTeamAssignmentCaptainIds,
  resolveActiveCaptainTeamRound,
} from "./captain-team-auto-assignment";

test("the next team round starts when the final match of the previous round finishes", () => {
  const round = resolveActiveCaptainTeamRound({
    tournamentStartsAt: new Date("2026-08-06T06:00:00.000Z"),
    stageStartsAt: new Date("2026-08-06T06:00:00.000Z"),
    matches: [
      {
        round: 1,
        status: MatchStatus.CONFIRMED,
        startsAt: null,
        scheduledAt: null,
        finishedAt: new Date("2026-08-06T10:00:00.000Z"),
        updatedAt: new Date("2026-08-06T10:00:00.000Z"),
      },
      {
        round: 2,
        status: MatchStatus.PENDING,
        startsAt: null,
        scheduledAt: null,
        finishedAt: null,
        updatedAt: new Date("2026-08-06T10:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(round, { round: 2, startedAt: new Date("2026-08-06T10:00:00.000Z") });
});

test("random captain assignments keep manual pairs and use every remaining player once", () => {
  const assignments = buildRandomCaptainTeamAssignments({
    slots: [
      { id: "manual", player1Id: "home-1", player2Id: "away-1" },
      { id: "open-1", player1Id: null, player2Id: null },
      { id: "open-2", player1Id: null, player2Id: null },
    ],
    homeUserIds: ["home-1", "home-2", "home-3"],
    awayUserIds: ["away-1", "away-2", "away-3"],
    random: () => 0,
  });

  assert.deepEqual(assignments.map((assignment) => assignment.matchId), ["open-1", "open-2"]);
  assert.deepEqual(new Set(assignments.map((assignment) => assignment.player1Id)), new Set(["home-2", "home-3"]));
  assert.deepEqual(new Set(assignments.map((assignment) => assignment.player2Id)), new Set(["away-2", "away-3"]));
});

test("the first team round starts when the stage is actually activated, not at a stale future tournament date", () => {
  const round = resolveActiveCaptainTeamRound({
    tournamentStartsAt: new Date("2026-08-20T06:00:00.000Z"),
    stageStartsAt: null,
    stageActivatedAt: new Date("2026-08-13T06:00:00.000Z"),
    matches: [
      {
        round: 1,
        status: MatchStatus.PENDING,
        startsAt: null,
        scheduledAt: null,
        finishedAt: null,
        updatedAt: new Date("2026-08-13T06:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(round, { round: 1, startedAt: new Date("2026-08-13T06:00:00.000Z") });
});

test("later stage edits do not restart the first-round assignment timer", () => {
  const round = resolveActiveCaptainTeamRound({
    tournamentStartsAt: new Date("2026-08-13T05:00:00.000Z"),
    stageStartsAt: new Date("2026-08-13T06:00:00.000Z"),
    stageActivatedAt: new Date("2026-08-13T10:00:00.000Z"),
    matches: [
      {
        round: 1,
        status: MatchStatus.PENDING,
        startsAt: null,
        scheduledAt: null,
        finishedAt: null,
        updatedAt: new Date("2026-08-13T06:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(round, { round: 1, startedAt: new Date("2026-08-13T06:00:00.000Z") });
});

test("random captain assignments repair a half-filled slot after a roster replacement", () => {
  const assignments = buildRandomCaptainTeamAssignments({
    slots: [
      { id: "half-filled", player1Id: "home-2", player2Id: null },
      { id: "open", player1Id: null, player2Id: null },
    ],
    homeUserIds: ["home-1", "home-2"],
    awayUserIds: ["away-1", "away-2"],
    random: () => 0,
  });

  assert.deepEqual(assignments, [
    {
      matchId: "half-filled",
      player1Id: "home-2",
      player2Id: "away-2",
      previousPlayer1Id: "home-2",
      previousPlayer2Id: null,
    },
    {
      matchId: "open",
      player1Id: "home-1",
      player2Id: "away-1",
      previousPlayer1Id: null,
      previousPlayer2Id: null,
    },
  ]);
});

test("round-start notifications target captains with open home slots", () => {
  assert.deepEqual(
    collectCaptainTeamAssignmentCaptainIds([
      {
        isCaptainAssignedTeamMatch: true,
        isTeamCaptainTiebreak: false,
        status: MatchStatus.PENDING,
        player1Id: null,
        player2Id: null,
        participant1Entry: {
          rosterMembers: [{ userId: "captain-a" }],
        },
      },
      {
        isCaptainAssignedTeamMatch: true,
        isTeamCaptainTiebreak: false,
        status: MatchStatus.READY,
        player1Id: "home-1",
        player2Id: "away-1",
        participant1Entry: {
          rosterMembers: [{ userId: "captain-b" }],
        },
      },
      {
        isCaptainAssignedTeamMatch: false,
        isTeamCaptainTiebreak: false,
        status: MatchStatus.PENDING,
        player1Id: null,
        player2Id: null,
        participant1Entry: {
          rosterMembers: [{ userId: "captain-c" }],
        },
      },
    ]),
    ["captain-a"],
  );
});
