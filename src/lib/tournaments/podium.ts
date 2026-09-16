import type { Match, TournamentParticipantMode } from "@prisma/client";
import { resolveCaptainTeamPlayoffAggregate } from "./captain-team-playoff";

export type PodiumPlace = 1 | 2 | 3;
export type PodiumMatch = Pick<Match,
  "id" | "matchNumber" | "status" | "seriesKey" | "seriesWinsRequired" | "legNumber" | "isPenaltyTiebreak" |
  "isCaptainAssignedTeamMatch" | "isTeamCaptainTiebreak" | "isThirdPlaceMatch" |
  "player1Id" | "player2Id" | "participant1EntryId" | "participant2EntryId" |
  "winnerId" | "winnerEntryId" | "player1Score" | "player2Score" |
  "player1PenaltyScore" | "player2PenaltyScore" | "finishedAt" | "updatedAt"
> & { lineupPlayers: Array<{ side: number; userId: string }> };

export function isPodiumResultConfirmed(match: Pick<PodiumMatch, "status">) {
  return match.status === "CONFIRMED" || match.status === "FINISHED" || match.status === "FORFEIT";
}

function entry(match: PodiumMatch, side: 1 | 2) {
  return side === 1 ? match.participant1EntryId ?? match.player1Id : match.participant2EntryId ?? match.player2Id;
}

function winner(match: PodiumMatch) {
  if (!isPodiumResultConfirmed(match)) return null;
  if (match.winnerEntryId) return match.winnerEntryId;
  if (!match.winnerId) return null;
  return match.winnerId === match.player1Id ? entry(match, 1) : match.winnerId === match.player2Id ? entry(match, 2) : null;
}

/** Read-only interpretation of a completed final; never changes match results or rosters. */
export function resolvePodiumSeries(matches: PodiumMatch[]) {
  const regular = matches.filter((match) => !match.isPenaltyTiebreak && !match.isTeamCaptainTiebreak && match.status !== "CANCELLED");
  const reference = regular[0];
  if (!reference) return null;
  const first = entry(reference, 1);
  const second = entry(reference, 2);
  if (!first || !second || first === second) return null;
  if (regular.some((match) => {
    const one = entry(match, 1), two = entry(match, 2);
    return !((one === first && two === second) || (one === second && two === first));
  })) return null;

  let winnerEntry: string | null = null;
  const required = reference.seriesWinsRequired ?? 1;
  if (regular.some((match) => match.isCaptainAssignedTeamMatch)) {
    const result = resolveCaptainTeamPlayoffAggregate(matches);
    if (result.state === "winner") winnerEntry = result.winnerEntryId;
    if (result.state === "tied") {
      const tiebreak = matches.find((match) => match.isTeamCaptainTiebreak && isPodiumResultConfirmed(match));
      winnerEntry = tiebreak ? winner(tiebreak) : null;
    }
  } else if (required > 1) {
    const wins = new Map<string, number>();
    for (const match of regular) {
      // A penalty game decides its linked leg, never an extra win in the series.
      const linkedPenalty = matches.find((item) => item.isPenaltyTiebreak && item.legNumber === match.legNumber && isPodiumResultConfirmed(item));
      const won = winner(match) ?? (isPodiumResultConfirmed(match) && linkedPenalty ? winner(linkedPenalty) : null);
      if (won) wins.set(won, (wins.get(won) ?? 0) + 1);
    }
    winnerEntry = [...wins].find(([, count]) => count >= required)?.[0] ?? null;
  } else {
    if (!regular.every(isPodiumResultConfirmed)) return null;
    const penalty = matches.find((match) => match.isPenaltyTiebreak && isPodiumResultConfirmed(match));
    const decidingGame = regular.find((match) => match.legNumber === 3);
    if (decidingGame) winnerEntry = winner(decidingGame);
    else if (regular.length === 1) winnerEntry = winner(reference) ?? (penalty ? winner(penalty) : null);
    else {
      let difference = 0;
      for (const match of regular) {
        if (match.player1Score === null || match.player2Score === null) return null;
        difference += (match.player1Score - match.player2Score) * (entry(match, 1) === first ? 1 : -1);
      }
      if (difference) winnerEntry = difference > 0 ? first : second;
      else {
        const decider = penalty ?? [...regular].reverse().find((match) => match.player1PenaltyScore !== null && match.player2PenaltyScore !== null && match.player1PenaltyScore !== match.player2PenaltyScore);
        winnerEntry = decider ? winner(decider) : null;
      }
    }
  }
  if (winnerEntry !== first && winnerEntry !== second) return null;
  return { winnerEntryId: winnerEntry, loserEntryId: winnerEntry === first ? second : first };
}

export function playedForPodiumEntry(matches: PodiumMatch[], registrationId: string, userId: string, mode: TournamentParticipantMode) {
  return matches.some((match) => {
    if (!isPodiumResultConfirmed(match)) return false;
    const side = entry(match, 1) === registrationId ? 1 : entry(match, 2) === registrationId ? 2 : null;
    if (!side) return false;
    const historical = match.lineupPlayers.filter((player) => player.side === side);
    if (historical.length) return historical.some((player) => player.userId === userId);
    // Missing old coop snapshots must not award medals to today's replacement roster.
    return mode === "SINGLE" && (side === 1 ? match.player1Id : match.player2Id) === userId;
  });
}
