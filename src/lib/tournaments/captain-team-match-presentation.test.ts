import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCaptainTeamMatchSlotLabels,
  compareCaptainAssignedTeamMatches,
} from "./captain-team-match-presentation";

function teamMatch(params: {
  id: string;
  matchNumber: number;
  home: string;
  away: string;
  createdAt: string;
}) {
  return {
    id: params.id,
    isCaptainAssignedTeamMatch: true,
    stageId: "league",
    groupId: "group",
    bracketId: null,
    round: 2,
    matchNumber: params.matchNumber,
    participant1EntryId: params.home,
    participant2EntryId: params.away,
    createdAt: params.createdAt,
    stage: { orderIndex: 0 },
    group: { orderIndex: 0 },
  };
}

const matches = [
  teamMatch({ id: "home-1", matchNumber: 47, home: "real", away: "barca", createdAt: "2026-08-02T08:15:22.000Z" }),
  teamMatch({ id: "away-1", matchNumber: 48, home: "barca", away: "real", createdAt: "2026-08-02T08:15:22.000Z" }),
  teamMatch({ id: "home-2", matchNumber: 47, home: "real", away: "barca", createdAt: "2026-08-02T08:15:28.000Z" }),
  teamMatch({ id: "home-3", matchNumber: 47, home: "real", away: "barca", createdAt: "2026-08-02T08:15:28.000Z" }),
  teamMatch({ id: "away-2", matchNumber: 48, home: "barca", away: "real", createdAt: "2026-08-02T08:15:28.000Z" }),
  teamMatch({ id: "away-3", matchNumber: 48, home: "barca", away: "real", createdAt: "2026-08-02T08:15:28.000Z" }),
];

test("labels every player pairing inside each home-away fixture", () => {
  const labels = buildCaptainTeamMatchSlotLabels(matches);

  assert.deepEqual(
    matches.map((match) => labels.get(match.id)),
    ["Пара 1 из 3", "Пара 1 из 3", "Пара 2 из 3", "Пара 3 из 3", "Пара 2 из 3", "Пара 3 из 3"],
  );
});

test("shows the current team's three home fixtures before its three away fixtures", () => {
  const ordered = [...matches].sort(
    (a, b) => compareCaptainAssignedTeamMatches(a, b, "real") ?? 0,
  );

  assert.deepEqual(
    ordered.map((match) => match.id),
    ["home-1", "home-2", "home-3", "away-1", "away-2", "away-3"],
  );
});
