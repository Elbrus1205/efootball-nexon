import { MatchStatus } from "@prisma/client";

const SUPERSEDED_CAPTAIN_TEAM_SERIES_KEY_PREFIX = "superseded:";

export function createSupersededCaptainTeamSeriesKey(params: {
  seriesKey: string | null;
  matchId: string;
  createdAtMs?: number;
}) {
  return `${SUPERSEDED_CAPTAIN_TEAM_SERIES_KEY_PREFIX}${params.seriesKey ?? params.matchId}:${params.matchId}:${params.createdAtMs ?? Date.now()}`;
}

export function isSupersededCaptainTeamSeriesArchive(params: {
  status: MatchStatus;
  seriesKey: string | null;
}) {
  return (
    params.status === MatchStatus.CANCELLED &&
    params.seriesKey?.startsWith(SUPERSEDED_CAPTAIN_TEAM_SERIES_KEY_PREFIX) === true
  );
}

export function shouldSkipCaptainTeamSeriesAssignment(params: {
  isCaptainAssignedTeamMatch: boolean;
  slot: 1 | 2;
  entryId: string | null;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
}) {
  if (!params.isCaptainAssignedTeamMatch || !params.entryId) return false;

  const currentEntryId = params.slot === 1
    ? params.participant1EntryId
    : params.participant2EntryId;

  return currentEntryId === params.entryId;
}

export function resolveCaptainTeamSeriesAssignmentSide(params: {
  previousEntryId: string | null;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
}): 1 | 2 | null {
  if (!params.previousEntryId) return null;
  if (params.participant1EntryId === params.previousEntryId) return 1;
  if (params.participant2EntryId === params.previousEntryId) return 2;
  return null;
}

export function shouldResetCaptainTeamSeriesProgress(params: {
  previousEntryId: string | null;
  nextEntryId: string | null;
}) {
  return params.previousEntryId !== null && params.previousEntryId !== params.nextEntryId;
}

export function hasCaptainTeamSeriesMatchHistory(params: {
  player1Score: number | null;
  player2Score: number | null;
  winnerEntryId: string | null;
  hasLineupSnapshot: boolean;
  hasResultSubmission: boolean;
}) {
  return (
    params.player1Score !== null ||
    params.player2Score !== null ||
    params.winnerEntryId !== null ||
    params.hasLineupSnapshot ||
    params.hasResultSubmission
  );
}

export function planCaptainTeamSeriesProgressReset(params: {
  previousEntryId: string | null;
  nextEntryId: string | null;
  player1Score: number | null;
  player2Score: number | null;
  winnerEntryId: string | null;
  hasLineupSnapshot: boolean;
  hasResultSubmission: boolean;
}) {
  const resetsProgress = shouldResetCaptainTeamSeriesProgress(params);
  return {
    resetsProgress,
    archivesHistory: resetsProgress && hasCaptainTeamSeriesMatchHistory(params),
  };
}

export function nextCaptainTeamSeriesAssignmentStatus(params: {
  currentStatus: MatchStatus;
  resetsProgress: boolean;
  isTeamCaptainTiebreak: boolean;
  hasPlayer1: boolean;
  hasPlayer2: boolean;
}) {
  if (params.resetsProgress && params.isTeamCaptainTiebreak) return MatchStatus.CANCELLED;
  const currentStatus = params.resetsProgress ? MatchStatus.PENDING : params.currentStatus;
  if (params.hasPlayer1 && params.hasPlayer2 && currentStatus === MatchStatus.PENDING) return MatchStatus.READY;
  if (params.hasPlayer1 && params.hasPlayer2 && currentStatus === MatchStatus.SCHEDULED) return MatchStatus.SCHEDULED;
  if (
    (!params.hasPlayer1 || !params.hasPlayer2) &&
    (currentStatus === MatchStatus.READY || currentStatus === MatchStatus.SCHEDULED)
  ) {
    return MatchStatus.PENDING;
  }
  return currentStatus;
}
