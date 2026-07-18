import {
  MatchStatus,
  ParticipantStatus,
  StageStatus,
  TournamentParticipantMode,
  TournamentStatus,
} from "@prisma/client";
import { getPlayerDisplayName } from "@/lib/player-name";

export const tournamentTabValues = [
  "structure",
  "matches",
  "my-matches",
  "roster",
  "participants",
  "rules",
] as const;

export type TournamentTabValue = (typeof tournamentTabValues)[number];

export type TournamentTabItem = {
  value: TournamentTabValue;
  label: string;
};

const tournamentTabs: TournamentTabItem[] = [
  { value: "structure", label: "Структура" },
  { value: "matches", label: "Расписание" },
  { value: "my-matches", label: "Мои матчи" },
  { value: "roster", label: "Состав" },
  { value: "participants", label: "Участники" },
  { value: "rules", label: "Правила" },
];

export type TournamentStagePresentationState = "completed" | "active" | "upcoming" | "locked";

export type LeagueRow = {
  id: string;
  rank?: number | null;
  clubName: string;
  clubBadgePath?: string | null;
  playerId?: string | null;
  playerName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDifference: number;
  points: number;
};

export type StandingHighlight = {
  fromRank: number;
  toRank: number;
  label: string;
  rowClass: string;
  badgeClass: string;
};

export function isTournamentTabValue(value?: string | null): value is TournamentTabValue {
  return Boolean(value && (tournamentTabValues as readonly string[]).includes(value));
}

export function getTournamentTabs(mode: TournamentParticipantMode) {
  return mode === TournamentParticipantMode.SINGLE
    ? tournamentTabs.filter((tab) => tab.value !== "roster")
    : tournamentTabs;
}

export function participantModeLabel(mode: TournamentParticipantMode, rosterSize: number) {
  if (mode === TournamentParticipantMode.SINGLE) return "1x1";
  if (mode === TournamentParticipantMode.COOP) return `${rosterSize}x${rosterSize}`;
  return `Команды ${rosterSize}`;
}

export function shouldShowOpenMyMatchesAction(status: TournamentStatus, alreadyRegistered: boolean) {
  return alreadyRegistered && status !== TournamentStatus.IN_PROGRESS && status !== TournamentStatus.COMPLETED;
}

export function stagePresentationState(status: StageStatus): TournamentStagePresentationState {
  switch (status) {
    case StageStatus.COMPLETED:
      return "completed";
    case StageStatus.ACTIVE:
      return "active";
    case StageStatus.PENDING:
      return "upcoming";
    case StageStatus.DRAFT:
      return "locked";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function isBrokenClubName(value: string | null | undefined) {
  const name = value?.trim();
  if (!name) return true;
  const questionMarks = name.match(/\?/g)?.length ?? 0;
  return questionMarks >= 3 || questionMarks / name.length > 0.4;
}

function resolveClubName(
  entry: { clubSlug?: string | null; clubName?: string | null; teamName?: string | null },
  clubsBySlug: Map<string, { name: string }>,
  fallback: string,
) {
  if (entry.teamName?.trim()) return entry.teamName.trim();
  if (entry.clubSlug) {
    const club = clubsBySlug.get(entry.clubSlug);
    if (club && isBrokenClubName(entry.clubName)) return club.name;
  }
  return entry.clubName?.trim() && !isBrokenClubName(entry.clubName) ? entry.clubName.trim() : fallback;
}

function resolveClubBadgePath(
  entry: { clubSlug?: string | null; clubBadgePath?: string | null },
  clubsBySlug: Map<string, { imagePath: string }>,
) {
  if (entry.clubBadgePath?.trim()) return entry.clubBadgePath;
  return entry.clubSlug ? clubsBySlug.get(entry.clubSlug)?.imagePath ?? null : null;
}

function getReplacementRegistrationId(notes?: string | null) {
  return notes?.match(/replacementRegistrationId:([A-Za-z0-9]+)/)?.[1] ?? null;
}

function resolveReplacementRegistrationId(entryId: string, replacements: Map<string, string>) {
  let current = entryId;
  const seen = new Set<string>();
  while (replacements.has(current) && !seen.has(current)) {
    seen.add(current);
    current = replacements.get(current)!;
  }
  return current;
}

export function buildLeagueTable(
  participants: Array<{
    id: string;
    userId: string;
    status?: ParticipantStatus;
    notes?: string | null;
    clubSlug: string | null;
    clubName: string | null;
    clubBadgePath: string | null;
    teamName?: string | null;
    user: { id: string; name: string | null };
  }>,
  matches: Array<{
    status?: MatchStatus;
    player1Id: string | null;
    player2Id: string | null;
    participant1EntryId?: string | null;
    participant2EntryId?: string | null;
    player1Score: number | null;
    player2Score: number | null;
  }>,
  clubsBySlug: Map<string, { name: string; imagePath: string }>,
  scoring: { pointsForWin?: number | null; pointsForDraw?: number | null; pointsForLoss?: number | null } = {},
) {
  const table = new Map<string, LeagueRow>();
  const pointsForWin = scoring.pointsForWin ?? 3;
  const pointsForDraw = scoring.pointsForDraw ?? 1;
  const pointsForLoss = scoring.pointsForLoss ?? 0;
  const participantIds = new Set(participants.map((entry) => entry.id));
  const replacementByEntryId = new Map(
    participants
      .filter((entry) => entry.status === ParticipantStatus.REMOVED)
      .map((entry) => [entry.id, getReplacementRegistrationId(entry.notes)])
      .filter((item): item is [string, string] => Boolean(item[1] && participantIds.has(item[1]))),
  );

  for (const entry of participants.filter(
    (item) => item.status !== ParticipantStatus.REMOVED && item.status !== ParticipantStatus.REJECTED,
  )) {
    const playerName = getPlayerDisplayName(entry.user);
    table.set(entry.id, {
      id: entry.user.id,
      playerId: entry.user.id,
      playerName,
      clubName: resolveClubName(entry, clubsBySlug, playerName),
      clubBadgePath: resolveClubBadgePath(entry, clubsBySlug),
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.status && match.status !== MatchStatus.CONFIRMED && match.status !== MatchStatus.FINISHED) continue;
    if (!match.participant1EntryId || !match.participant2EntryId) continue;
    if (match.player1Score === null || match.player2Score === null) continue;

    const player1 = table.get(resolveReplacementRegistrationId(match.participant1EntryId, replacementByEntryId));
    const player2 = table.get(resolveReplacementRegistrationId(match.participant2EntryId, replacementByEntryId));
    if (!player1 || !player2) continue;

    player1.played += 1;
    player2.played += 1;
    player1.goalDifference += match.player1Score - match.player2Score;
    player2.goalDifference += match.player2Score - match.player1Score;

    if (match.player1Score > match.player2Score) {
      player1.wins += 1;
      player2.losses += 1;
      player1.points += pointsForWin;
      player2.points += pointsForLoss;
    } else if (match.player1Score < match.player2Score) {
      player2.wins += 1;
      player1.losses += 1;
      player2.points += pointsForWin;
      player1.points += pointsForLoss;
    } else {
      player1.draws += 1;
      player2.draws += 1;
      player1.points += pointsForDraw;
      player2.points += pointsForDraw;
    }
  }

  return Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.clubName.localeCompare(b.clubName, "ru");
  });
}
