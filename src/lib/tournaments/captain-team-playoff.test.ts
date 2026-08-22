import assert from "node:assert/strict";
import test from "node:test";
import { resolveCaptainTeamPlayoffAggregate } from "./captain-team-playoff";

function playoffMatch(params: {
  id: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
  status?: string;
}) {
  return {
    id: params.id,
    isCaptainAssignedTeamMatch: true,
    isTeamCaptainTiebreak: false,
    isPenaltyTiebreak: false,
    status: params.status ?? "CONFIRMED",
    participant1EntryId: params.home,
    participant2EntryId: params.away,
    player1Score: params.homeScore,
    player2Score: params.awayScore,
    player1PenaltyScore: params.homePenaltyScore ?? null,
    player2PenaltyScore: params.awayPenaltyScore ?? null,
  };
}

test("waits for all six team playoff matches before resolving the aggregate", () => {
  const matches = Array.from({ length: 6 }, (_, index) =>
    playoffMatch({
      id: `match-${index + 1}`,
      home: index < 3 ? "team-a" : "team-b",
      away: index < 3 ? "team-b" : "team-a",
      homeScore: index === 5 ? null : 1,
      awayScore: index === 5 ? null : 0,
      status: index === 5 ? "READY" : "CONFIRMED",
    }),
  );

  assert.deepEqual(resolveCaptainTeamPlayoffAggregate(matches), { state: "pending" });
});

test("returns a tie when both teams win three playoff matches", () => {
  const matches = [
    ...Array.from({ length: 3 }, (_, index) =>
      playoffMatch({ id: `home-${index}`, home: "team-a", away: "team-b", homeScore: 1, awayScore: 0 }),
    ),
    ...Array.from({ length: 3 }, (_, index) =>
      playoffMatch({ id: `away-${index}`, home: "team-b", away: "team-a", homeScore: 1, awayScore: 0 }),
    ),
  ];

  assert.deepEqual(resolveCaptainTeamPlayoffAggregate(matches), {
    state: "tied",
    participant1EntryId: "team-a",
    participant2EntryId: "team-b",
    participant1Score: 3,
    participant2Score: 3,
    winnerEntryId: null,
    loserEntryId: null,
  });
});

test("returns the team with more match wins even when aggregate goals are lower", () => {
  const matches = [
    playoffMatch({ id: "a-win-1", home: "team-a", away: "team-b", homeScore: 1, awayScore: 0 }),
    playoffMatch({ id: "a-win-2", home: "team-a", away: "team-b", homeScore: 1, awayScore: 0 }),
    playoffMatch({ id: "a-win-3", home: "team-a", away: "team-b", homeScore: 1, awayScore: 0 }),
    playoffMatch({ id: "a-win-4", home: "team-b", away: "team-a", homeScore: 0, awayScore: 1 }),
    playoffMatch({ id: "b-win-1", home: "team-b", away: "team-a", homeScore: 6, awayScore: 0 }),
    playoffMatch({ id: "b-win-2", home: "team-b", away: "team-a", homeScore: 6, awayScore: 0 }),
  ];

  const result = resolveCaptainTeamPlayoffAggregate(matches);
  assert.equal(result.state, "winner");
  assert.equal(result.state === "winner" ? result.participant1Score : null, 4);
  assert.equal(result.state === "winner" ? result.participant2Score : null, 2);
  assert.equal(result.state === "winner" ? result.winnerEntryId : null, "team-a");
});

test("counts a tied playoff match by its penalty winner", () => {
  const matches = [
    playoffMatch({
      id: "penalty-home-win",
      home: "team-a",
      away: "team-b",
      homeScore: 2,
      awayScore: 2,
      homePenaltyScore: 5,
      awayPenaltyScore: 4,
    }),
    ...Array.from({ length: 3 }, (_, index) =>
      playoffMatch({ id: `home-${index}`, home: "team-a", away: "team-b", homeScore: 1, awayScore: 0 }),
    ),
    ...Array.from({ length: 2 }, (_, index) =>
      playoffMatch({ id: `away-${index}`, home: "team-b", away: "team-a", homeScore: 1, awayScore: 0 }),
    ),
  ];

  const result = resolveCaptainTeamPlayoffAggregate(matches);
  assert.equal(result.state, "winner");
  assert.equal(result.state === "winner" ? result.participant1Score : null, 4);
  assert.equal(result.state === "winner" ? result.participant2Score : null, 2);
  assert.equal(result.state === "winner" ? result.winnerEntryId : null, "team-a");
});

test("waits for penalties when a tied playoff match has no winner yet", () => {
  const matches = [
    playoffMatch({ id: "draw-without-penalty", home: "team-a", away: "team-b", homeScore: 2, awayScore: 2 }),
    ...Array.from({ length: 5 }, (_, index) =>
      playoffMatch({
        id: `decided-${index}`,
        home: index < 3 ? "team-a" : "team-b",
        away: index < 3 ? "team-b" : "team-a",
        homeScore: 1,
        awayScore: 0,
      }),
    ),
  ];

  assert.deepEqual(resolveCaptainTeamPlayoffAggregate(matches), { state: "pending" });
});

test("ignores cancelled rows left by a repaired playoff series", () => {
  const matches = [
    ...Array.from({ length: 5 }, (_, index) =>
      playoffMatch({
        id: `city-win-${index}`,
        home: index < 3 ? "city" : "hilal",
        away: index < 3 ? "hilal" : "city",
        homeScore: index < 3 ? 1 : 0,
        awayScore: index < 3 ? 0 : 1,
      }),
    ),
    playoffMatch({ id: "hilal-win", home: "city", away: "hilal", homeScore: 0, awayScore: 1 }),
    playoffMatch({
      id: "superseded-row",
      home: "hilal",
      away: "old-opponent",
      homeScore: null,
      awayScore: null,
      status: "CANCELLED",
    }),
  ];

  const result = resolveCaptainTeamPlayoffAggregate(matches);
  assert.equal(result.state, "winner");
  assert.equal(result.state === "winner" ? result.winnerEntryId : null, "city");
  assert.equal(result.state === "winner" ? result.participant1Score : null, 5);
  assert.equal(result.state === "winner" ? result.participant2Score : null, 1);
});
