import assert from "node:assert/strict";
import test from "node:test";
import { resolveCaptainTeamPlayoffAggregate } from "./captain-team-playoff";

function playoffMatch(params: {
  id: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
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

test("returns a tie after normalizing the reversed home and away leg", () => {
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

test("returns the team with the higher score across all six matches", () => {
  const matches = [
    ...Array.from({ length: 3 }, (_, index) =>
      playoffMatch({ id: `home-${index}`, home: "team-a", away: "team-b", homeScore: 2, awayScore: 0 }),
    ),
    ...Array.from({ length: 3 }, (_, index) =>
      playoffMatch({ id: `away-${index}`, home: "team-b", away: "team-a", homeScore: 1, awayScore: 1 }),
    ),
  ];

  const result = resolveCaptainTeamPlayoffAggregate(matches);
  assert.equal(result.state, "winner");
  assert.equal(result.state === "winner" ? result.winnerEntryId : null, "team-a");
});
