import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchStatus, ParticipantStatus, StageStatus, TournamentParticipantMode, TournamentStatus } from "@prisma/client";
import {
  buildLeagueTable,
  getTournamentTabs,
  isTournamentTabValue,
  participantModeLabel,
  participantsForStageGroup,
  prioritizeCurrentGroup,
  shouldShowOpenMyMatchesAction,
  stagePresentationState,
} from "@/lib/tournament-public-view";

const clubs = new Map<string, { name: string; imagePath: string }>();

function participant(
  id: string,
  name: string,
  options: { status?: ParticipantStatus; notes?: string | null } = {},
) {
  return {
    id,
    userId: `user-${id}`,
    status: options.status ?? ParticipantStatus.CONFIRMED,
    notes: options.notes ?? null,
    clubSlug: null,
    clubName: name,
    clubBadgePath: null,
    user: { id: `user-${id}`, name },
  };
}

test("validates public tabs and hides roster for 1x1 tournaments", () => {
  assert.equal(isTournamentTabValue("structure"), true);
  assert.equal(isTournamentTabValue("unknown"), false);
  assert.deepEqual(getTournamentTabs(TournamentParticipantMode.SINGLE).map((tab) => tab.value), [
    "structure",
    "matches",
    "my-matches",
    "participants",
    "rules",
  ]);
  assert.equal(getTournamentTabs(TournamentParticipantMode.COOP).some((tab) => tab.value === "roster"), true);
  assert.equal(participantModeLabel(TournamentParticipantMode.SINGLE, 1), "1x1");
  assert.equal(participantModeLabel(TournamentParticipantMode.COOP, 2), "2x2");
});

test("maps every persisted stage status to a distinct presentation state", () => {
  assert.equal(stagePresentationState(StageStatus.COMPLETED), "completed");
  assert.equal(stagePresentationState(StageStatus.ACTIVE), "active");
  assert.equal(stagePresentationState(StageStatus.PENDING), "upcoming");
  assert.equal(stagePresentationState(StageStatus.DRAFT), "locked");
});

test("hides the open-my-matches hero action after the tournament starts", () => {
  assert.equal(shouldShowOpenMyMatchesAction(TournamentStatus.REGISTRATION_OPEN, true), true);
  assert.equal(shouldShowOpenMyMatchesAction(TournamentStatus.IN_PROGRESS, true), false);
  assert.equal(shouldShowOpenMyMatchesAction(TournamentStatus.COMPLETED, true), false);
  assert.equal(shouldShowOpenMyMatchesAction(TournamentStatus.IN_PROGRESS, false), false);
});

test("shows the viewer group first without mutating the official group order", () => {
  const groups = [{ id: "a" }, { id: "b" }, { id: "c" }];

  assert.deepEqual(prioritizeCurrentGroup(groups, "b").map((group) => group.id), ["b", "a", "c"]);
  assert.deepEqual(groups.map((group) => group.id), ["a", "b", "c"]);
  assert.deepEqual(prioritizeCurrentGroup(groups, "unknown").map((group) => group.id), ["a", "b", "c"]);
});

test("keeps a completed national group full after its teams advance to another stage", () => {
  const historical = participant("historical", "Старый игрок", {
    status: ParticipantStatus.REMOVED,
    notes: "replacementRegistrationId:replacement",
  });
  const replacement = participant("replacement", "Новый игрок");
  const steady = participant("steady", "Оставшийся игрок");

  const groupMembers = participantsForStageGroup(
    [historical, replacement, steady].map((entry) => ({ ...entry, groupId: entry.id === "replacement" ? "europe" : "national" })),
    ["historical", "steady"],
  );

  assert.deepEqual(groupMembers.map((entry) => entry.id), ["historical", "replacement", "steady"]);
  const rows = buildLeagueTable(groupMembers, [], clubs);
  assert.deepEqual(rows.map((row) => row.playerName), ["Новый игрок", "Оставшийся игрок"]);
});

test("calculates standings and preserves deterministic tie ordering", () => {
  const rows = buildLeagueTable(
    [participant("a", "Альфа"), participant("b", "Бета"), participant("c", "Вега")],
    [
      {
        status: MatchStatus.CONFIRMED,
        player1Id: "user-a",
        player2Id: "user-b",
        participant1EntryId: "a",
        participant2EntryId: "b",
        player1Score: 3,
        player2Score: 1,
      },
      {
        status: MatchStatus.FINISHED,
        player1Id: "user-b",
        player2Id: "user-c",
        participant1EntryId: "b",
        participant2EntryId: "c",
        player1Score: 2,
        player2Score: 2,
      },
    ],
    clubs,
  );

  assert.deepEqual(rows.map((row) => row.clubName), ["Альфа", "Вега", "Бета"]);
  assert.deepEqual(rows.map((row) => [row.points, row.goalDifference]), [[3, 2], [1, 0], [1, -2]]);
  assert.equal(rows.find((row) => row.id === "user-a")?.playerId, "user-a");
  assert.deepEqual(rows.map((row) => [row.wins, row.draws, row.losses]), [[1, 0, 0], [0, 1, 0], [0, 1, 1]]);
});

test("keeps inactive-opponent matches in tournament standings while excluding only personal statistics", () => {
  const rows = buildLeagueTable(
    [participant("active", "Active"), participant("inactive", "Inactive")],
    [{
      status: MatchStatus.CONFIRMED,
      player1Id: "user-active",
      player2Id: "user-inactive",
      participant1EntryId: "active",
      participant2EntryId: "inactive",
      player1Score: 2,
      player2Score: 0,
      excludeFromStatistics: true,
      excludeFromTournamentStandings: false,
    }],
    clubs,
  );

  assert.equal(rows.find((row) => row.clubName === "Active")?.points, 3);
  assert.equal(rows.find((row) => row.clubName === "Active")?.wins, 1);
  assert.equal(rows.find((row) => row.clubName === "Inactive")?.losses, 1);
});

test("attributes historical matches to a confirmed replacement entry", () => {
  const rows = buildLeagueTable(
    [
      participant("old", "Старый", {
        status: ParticipantStatus.REMOVED,
        notes: "replacementRegistrationId:new",
      }),
      participant("new", "Новый"),
      participant("rival", "Соперник"),
    ],
    [{
      status: MatchStatus.CONFIRMED,
      player1Id: "user-old",
      player2Id: "user-rival",
      participant1EntryId: "old",
      participant2EntryId: "rival",
      player1Score: 1,
      player2Score: 0,
    }],
    clubs,
  );

  assert.equal(rows.find((row) => row.clubName === "Новый")?.points, 3);
  assert.equal(rows.some((row) => row.clubName === "Старый"), false);
});
