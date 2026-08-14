import { MatchStatus } from "@prisma/client";

const TERMINAL_STATUSES = new Set<MatchStatus>([
  MatchStatus.CONFIRMED,
  MatchStatus.FINISHED,
  MatchStatus.FORFEIT,
  MatchStatus.CANCELLED,
]);

export type CaptainTeamRoundMatch = {
  round: number;
  status: MatchStatus;
  startsAt: Date | null;
  scheduledAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
};

export function resolveActiveCaptainTeamRound(params: {
  matches: CaptainTeamRoundMatch[];
  tournamentStartsAt: Date;
  stageStartsAt: Date | null;
  stageActivatedAt?: Date | null;
}) {
  const rounds = Array.from(new Set(params.matches.map((match) => match.round))).sort((a, b) => a - b);
  const activeRound = rounds.find((round) => {
    const roundMatches = params.matches.filter((match) => match.round === round);
    if (!roundMatches.some((match) => !TERMINAL_STATUSES.has(match.status))) return false;
    return params.matches
      .filter((match) => match.round < round)
      .every((match) => TERMINAL_STATUSES.has(match.status));
  });

  if (activeRound === undefined) return null;

  const currentMatches = params.matches.filter((match) => match.round === activeRound);
  const plannedStarts = currentMatches
    .map((match) => match.startsAt ?? match.scheduledAt)
    .filter((value): value is Date => Boolean(value));
  const plannedRoundStart = plannedStarts.length
    ? new Date(Math.min(...plannedStarts.map((value) => value.getTime())))
    : null;

  const previousMatches = params.matches.filter((match) => match.round < activeRound);
  const firstRoundStart = params.stageStartsAt ?? params.stageActivatedAt ?? params.tournamentStartsAt;
  const lifecycleStart = previousMatches.length
    ? new Date(Math.max(...previousMatches.map((match) => (match.finishedAt ?? match.updatedAt).getTime())))
    : firstRoundStart;
  const startedAt = plannedRoundStart && plannedRoundStart > lifecycleStart ? plannedRoundStart : lifecycleStart;

  return { round: activeRound, startedAt };
}

export function buildRandomCaptainTeamAssignments(params: {
  slots: Array<{ id: string; player1Id: string | null; player2Id: string | null }>;
  homeUserIds: string[];
  awayUserIds: string[];
  occupiedUserIds?: Iterable<string>;
  random?: () => number;
}) {
  const random = params.random ?? Math.random;
  const occupied = new Set(params.occupiedUserIds ?? []);
  for (const slot of params.slots) {
    if (slot.player1Id) occupied.add(slot.player1Id);
    if (slot.player2Id) occupied.add(slot.player2Id);
  }

  const shuffle = (values: string[]) => {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  };

  // A roster replacement can leave a slot half-filled when an older request
  // raced with the replacement transaction. Treat that row as an open slot,
  // but never replace the player that is already there.
  const openSlots = params.slots.filter((slot) => !slot.player1Id || !slot.player2Id);
  const homeUsers = shuffle(Array.from(new Set(params.homeUserIds)).filter((userId) => !occupied.has(userId)));
  const awayUsers = shuffle(Array.from(new Set(params.awayUserIds)).filter((userId) => !occupied.has(userId)));
  const homeAssignments = new Map<string, string>();
  const awayAssignments = new Map<string, string>();

  for (const slot of openSlots) {
    if (slot.player1Id) homeAssignments.set(slot.id, slot.player1Id);
    if (slot.player2Id) awayAssignments.set(slot.id, slot.player2Id);
  }

  const availableHomeUsers = [...homeUsers];
  const availableAwayUsers = [...awayUsers];
  for (const slot of openSlots) {
    if (!homeAssignments.has(slot.id)) {
      const player1Id = availableHomeUsers.shift();
      if (!player1Id) break;
      homeAssignments.set(slot.id, player1Id);
    }
    if (!awayAssignments.has(slot.id)) {
      const player2Id = availableAwayUsers.shift();
      if (!player2Id) break;
      awayAssignments.set(slot.id, player2Id);
    }
  }

  return openSlots
    .filter((slot) => homeAssignments.has(slot.id) && awayAssignments.has(slot.id))
    .map((slot) => ({
      matchId: slot.id,
      player1Id: homeAssignments.get(slot.id)!,
      player2Id: awayAssignments.get(slot.id)!,
      previousPlayer1Id: slot.player1Id,
      previousPlayer2Id: slot.player2Id,
    }));
}
