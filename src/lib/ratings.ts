import {
  MatchStatus,
  ParticipantStatus,
  Prisma,
  TeamInviteStatus,
  TournamentParticipantMode,
  TournamentStatus,
  User,
  UserRole,
  type ProfileStatusTone,
  type ProfileStatusType,
} from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { getSelectedProfileStatusWhere } from "@/lib/profile-status-query";

const INITIAL_RATING = 500;
const K_FACTOR = 30;
const PLAYER_RATING_RESET_PREFIX = "playerRatingResetAt:";
const PLAYER_STATS_RESET_PREFIX = "playerStatsResetAt:";
const RATING_ABSENCE_PENALTY_PREFIX = "ratingAbsencePenalty:";
const RATING_ABSENCE_PENALTY_APPLIED_PREFIX = "ratingAbsencePenaltyApplied:";
const ABSENCE_PENALTY_AMOUNT = -30;
const ABSENCE_PENALTY_TOP_LIMIT = 30;
const TOURNAMENT_BONUSES = {
  champion: 80,
  finalist: 40,
  thirdPlace: 20,
};

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10;
}

type RatingPlayer = Pick<User, "id" | "name" | "image"> & {
  profileStatuses?: Array<{ id: string; title: string; tone: ProfileStatusTone; type: ProfileStatusType; selectedOrder: number | null }>;
};

type RatingMatchSideSource = {
  tournament: { participantMode: TournamentParticipantMode };
  player1: RatingPlayer | null;
  player2: RatingPlayer | null;
  lineupPlayers: Array<{ side: number; user: RatingPlayer }>;
  participant1Entry: { rosterMembers: Array<{ user: RatingPlayer }> } | null;
  participant2Entry: { rosterMembers: Array<{ user: RatingPlayer }> } | null;
};

const ratingPlayerSelect = {
  id: true,
  name: true,
  image: true,
  profileStatuses: {
    where: getSelectedProfileStatusWhere(),
    select: { id: true, title: true, tone: true, type: true, selectedOrder: true },
    orderBy: [{ selectedOrder: "asc" }],
    take: 3,
  },
} satisfies Prisma.UserSelect;

type PlayerRatingOptions = {
  seasonId?: string | null;
};

export type PlayerRatingRow = {
  playerId: string;
  playerName: string;
  image?: string | null;
  rating: number;
  matchRating: number;
  bonus: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  lastRatingChange: number;
  lastRatingChangeAt: Date | null;
  lastMatchAt: Date | null;
  selectedStatuses: Array<{ id: string; title: string; tone: ProfileStatusTone; type: ProfileStatusType }>;
};

const getCachedPlayerRatings = unstable_cache(
  async (seasonId: string | null) => computePlayerRatings({ seasonId }),
  ["player-ratings"],
  { revalidate: 60 },
);

function expectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

function emptyRatingRow(player: RatingPlayer): PlayerRatingRow {
  return {
    playerId: player.id,
    playerName: getPlayerDisplayName(player),
    image: player.image,
    rating: INITIAL_RATING,
    matchRating: INITIAL_RATING,
    bonus: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    lastRatingChange: 0,
    lastRatingChangeAt: null,
    lastMatchAt: null,
    selectedStatuses: (player.profileStatuses ?? [])
      .filter((status) => status.selectedOrder !== null)
      .sort((a, b) => (a.selectedOrder ?? 99) - (b.selectedOrder ?? 99))
      .slice(0, 3)
      .map((status) => ({ id: status.id, title: status.title, tone: status.tone, type: status.type })),
  };
}

function ensurePlayer(rows: Map<string, PlayerRatingRow>, player: RatingPlayer) {
  const existing = rows.get(player.id);
  if (existing) return existing;

  const row = emptyRatingRow(player);
  rows.set(player.id, row);
  return row;
}

function applyTournamentBonus(row: PlayerRatingRow, bonus: number) {
  row.bonus += bonus;
  row.rating += bonus;
}

function uniqueRatingPlayers(players: RatingPlayer[]) {
  const seen = new Set<string>();
  return players.filter((player) => {
    if (seen.has(player.id)) return false;
    seen.add(player.id);
    return true;
  });
}

function getRatingMatchSidePlayers(match: RatingMatchSideSource, side: 1 | 2) {
  const snapshotPlayers = match.lineupPlayers.filter((lineupPlayer) => lineupPlayer.side === side).map((lineupPlayer) => lineupPlayer.user);
  if (snapshotPlayers.length) {
    return uniqueRatingPlayers(snapshotPlayers);
  }

  const fallback = side === 1 ? match.player1 : match.player2;
  const entry = side === 1 ? match.participant1Entry : match.participant2Entry;

  if (match.tournament.participantMode === TournamentParticipantMode.COOP && entry?.rosterMembers.length) {
    return uniqueRatingPlayers(entry.rosterMembers.map((member) => member.user));
  }

  return fallback ? [fallback] : [];
}

function matchDate(match: { finishedAt?: Date | null; updatedAt: Date; createdAt: Date }) {
  return match.finishedAt ?? match.updatedAt ?? match.createdAt;
}

function parseStoredDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRatingPenalty(value: string) {
  try {
    const parsed = JSON.parse(value) as { amount?: unknown; appliedAt?: unknown; startsAt?: unknown; seasonId?: unknown };
    const amount = typeof parsed.amount === "number" ? parsed.amount : ABSENCE_PENALTY_AMOUNT;
    const date = parseStoredDate(typeof parsed.appliedAt === "string" ? parsed.appliedAt : typeof parsed.startsAt === "string" ? parsed.startsAt : null);
    const seasonId = typeof parsed.seasonId === "string" ? parsed.seasonId : null;
    return date ? { amount, date, seasonId } : null;
  } catch {
    return null;
  }
}

export async function getPlayerRatings(options: PlayerRatingOptions = {}) {
  return getCachedPlayerRatings(options.seasonId ?? null);
}

async function computePlayerRatings(options: PlayerRatingOptions = {}) {
  const matchWhere: Prisma.MatchWhereInput = {
    status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED] },
    player1Id: { not: null },
    player2Id: { not: null },
    player1Score: { not: null },
    player2Score: { not: null },
    isPenaltyTiebreak: false,
    tournament: { isTest: false },
  };

  const tournamentWhere: Prisma.TournamentWhereInput = {
    status: TournamentStatus.COMPLETED,
    isTest: false,
  };

  if (options.seasonId) {
    matchWhere.tournament = { seasonId: options.seasonId, isTest: false };
    tournamentWhere.seasonId = options.seasonId;
  }

  const [players, matches, completedTournaments, ratingSettings] = await db.$transaction([
    db.user.findMany({
      where: { role: UserRole.PLAYER, isBanned: false },
      select: ratingPlayerSelect,
      orderBy: { createdAt: "asc" },
    }),
    db.match.findMany({
      where: matchWhere,
      include: {
        tournament: { select: { participantMode: true } },
        player1: { select: ratingPlayerSelect },
        player2: { select: ratingPlayerSelect },
        lineupPlayers: {
          select: {
            side: true,
            user: { select: ratingPlayerSelect },
          },
          orderBy: [{ side: "asc" }, { createdAt: "asc" }],
        },
        participant1Entry: {
          select: {
            rosterMembers: {
              where: { status: TeamInviteStatus.ACCEPTED },
              select: { user: { select: ratingPlayerSelect } },
              orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
            },
          },
        },
        participant2Entry: {
          select: {
            rosterMembers: {
              where: { status: TeamInviteStatus.ACCEPTED },
              select: { user: { select: ratingPlayerSelect } },
              orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
            },
          },
        },
      },
      orderBy: [{ finishedAt: "asc" }, { updatedAt: "asc" }, { createdAt: "asc" }],
    }),
    db.tournament.findMany({
      where: tournamentWhere,
      include: {
        matches: {
          where: {
            status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED] },
            player1Id: { not: null },
            player2Id: { not: null },
            player1Score: { not: null },
            player2Score: { not: null },
            isPenaltyTiebreak: false,
          },
          include: {
            tournament: { select: { participantMode: true } },
            player1: { select: ratingPlayerSelect },
            player2: { select: ratingPlayerSelect },
            winner: { select: ratingPlayerSelect },
            lineupPlayers: {
              select: {
                side: true,
                user: { select: ratingPlayerSelect },
              },
              orderBy: [{ side: "asc" }, { createdAt: "asc" }],
            },
            participant1Entry: {
              select: {
                rosterMembers: {
                  where: { status: TeamInviteStatus.ACCEPTED },
                  select: { user: { select: ratingPlayerSelect } },
                  orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
                },
              },
            },
            participant2Entry: {
              select: {
                rosterMembers: {
                  where: { status: TeamInviteStatus.ACCEPTED },
                  select: { user: { select: ratingPlayerSelect } },
                  orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
                },
              },
            },
          },
          orderBy: [{ round: "desc" }, { matchNumber: "asc" }],
        },
      },
    }),
    db.siteContent.findMany({
      where: {
        OR: [
          ...(options.seasonId ? [] : [{ key: { startsWith: "ratingOverride:" } }]),
          { key: { startsWith: PLAYER_RATING_RESET_PREFIX } },
          { key: { startsWith: PLAYER_STATS_RESET_PREFIX } },
          { key: { startsWith: RATING_ABSENCE_PENALTY_PREFIX } },
        ],
      },
      select: { key: true, body: true },
    }),
  ]);

  const rows = new Map<string, PlayerRatingRow>();
  players.forEach((player) => ensurePlayer(rows, player));
  const ratingResetAtByPlayerId = new Map<string, Date>();
  const statsResetAtByPlayerId = new Map<string, Date>();
  const ratingAdjustments: Array<{ playerId: string; amount: number; date: Date }> = [];

  for (const setting of ratingSettings) {
    if (setting.key.startsWith(PLAYER_RATING_RESET_PREFIX)) {
      const date = parseStoredDate(setting.body);
      if (date) ratingResetAtByPlayerId.set(setting.key.replace(PLAYER_RATING_RESET_PREFIX, ""), date);
    } else if (setting.key.startsWith(PLAYER_STATS_RESET_PREFIX)) {
      const date = parseStoredDate(setting.body);
      if (date) statsResetAtByPlayerId.set(setting.key.replace(PLAYER_STATS_RESET_PREFIX, ""), date);
    } else if (setting.key.startsWith(RATING_ABSENCE_PENALTY_PREFIX)) {
      const penalty = parseRatingPenalty(setting.body);
      if (penalty && (!options.seasonId || penalty.seasonId === options.seasonId)) {
        ratingAdjustments.push({
          playerId: setting.key.slice(setting.key.lastIndexOf(":") + 1),
          amount: penalty.amount,
          date: penalty.date,
        });
      }
    }
  }

  const shouldCountStats = (playerId: string, date: Date) => {
    const resetAt = statsResetAtByPlayerId.get(playerId);
    return !resetAt || date >= resetAt;
  };

  function applyMatchRating(match: (typeof matches)[number]) {
    if (!match.player1 || !match.player2 || match.player1Score === null || match.player2Score === null) return;

    const sideOnePlayers = getRatingMatchSidePlayers(match, 1);
    const sideTwoPlayers = getRatingMatchSidePlayers(match, 2);
    if (!sideOnePlayers.length || !sideTwoPlayers.length) return;

    const sideOneRows = sideOnePlayers.map((player) => ensurePlayer(rows, player));
    const sideTwoRows = sideTwoPlayers.map((player) => ensurePlayer(rows, player));
    const sideOneRatingBefore = sideOneRows.reduce((sum, row) => sum + row.rating, 0) / sideOneRows.length;
    const sideTwoRatingBefore = sideTwoRows.reduce((sum, row) => sum + row.rating, 0) / sideTwoRows.length;
    const sideOneExpected = expectedScore(sideOneRatingBefore, sideTwoRatingBefore);
    const sideTwoExpected = expectedScore(sideTwoRatingBefore, sideOneRatingBefore);
    const playerOneScore = match.player1Score > match.player2Score ? 1 : match.player1Score === match.player2Score ? 0.5 : 0;
    const playerTwoScore = 1 - playerOneScore;
    const sideOneDelta = K_FACTOR * (playerOneScore - sideOneExpected);
    const sideTwoDelta = K_FACTOR * (playerTwoScore - sideTwoExpected);
    const playedAt = matchDate(match);
    const sideOneGoals = match.player1Score;
    const sideTwoGoals = match.player2Score;

    sideOneRows.forEach((row) => {
      row.matchRating = Math.max(0, row.matchRating + sideOneDelta);
      row.rating = Math.max(0, row.rating + sideOneDelta);
      row.lastRatingChange = sideOneDelta;
      row.lastRatingChangeAt = playedAt;

      if (!shouldCountStats(row.playerId, playedAt)) return;
      row.played += 1;
      row.goalsFor += sideOneGoals;
      row.goalsAgainst += sideTwoGoals;
      row.goalDifference = row.goalsFor - row.goalsAgainst;
      row.lastMatchAt = !row.lastMatchAt || playedAt > row.lastMatchAt ? playedAt : row.lastMatchAt;
      if (playerOneScore === 1) row.wins += 1;
      else if (playerOneScore === 0) row.losses += 1;
      else row.draws += 1;
    });

    sideTwoRows.forEach((row) => {
      row.matchRating = Math.max(0, row.matchRating + sideTwoDelta);
      row.rating = Math.max(0, row.rating + sideTwoDelta);
      row.lastRatingChange = sideTwoDelta;
      row.lastRatingChangeAt = playedAt;

      if (!shouldCountStats(row.playerId, playedAt)) return;
      row.played += 1;
      row.goalsFor += sideTwoGoals;
      row.goalsAgainst += sideOneGoals;
      row.goalDifference = row.goalsFor - row.goalsAgainst;
      row.lastMatchAt = !row.lastMatchAt || playedAt > row.lastMatchAt ? playedAt : row.lastMatchAt;
      if (playerTwoScore === 1) row.wins += 1;
      else if (playerTwoScore === 0) row.losses += 1;
      else row.draws += 1;
    });
  }

  const ratingEvents: Array<
    | { type: "match"; date: Date; order: number; match: (typeof matches)[number] }
    | { type: "bonus"; date: Date; order: number; player: RatingPlayer; bonus: number }
    | { type: "reset"; date: Date; order: number; playerId: string }
    | { type: "adjustment"; date: Date; order: number; playerId: string; amount: number }
  > = matches.map((match) => ({ type: "match", date: matchDate(match), order: 0, match }));

  for (const [playerId, date] of Array.from(ratingResetAtByPlayerId.entries())) {
    ratingEvents.push({ type: "reset", date, order: -1, playerId });
  }

  for (const adjustment of ratingAdjustments) {
    ratingEvents.push({ type: "adjustment", date: adjustment.date, order: 4, playerId: adjustment.playerId, amount: adjustment.amount });
  }

  for (const tournament of completedTournaments) {
    const mainMatches = tournament.matches.filter((match) => !match.isThirdPlaceMatch);
    const finalMatch = mainMatches[0];
    const thirdPlaceMatch = tournament.matches.find((match) => match.isThirdPlaceMatch);
    const bonusDate = tournament.endsAt ?? (finalMatch ? matchDate(finalMatch) : tournament.updatedAt);

    if (finalMatch?.winner) {
      const championSide = finalMatch.winnerId === finalMatch.player1Id ? 1 : finalMatch.winnerId === finalMatch.player2Id ? 2 : null;
      const finalistSide = championSide === 1 ? 2 : championSide === 2 ? 1 : null;

      if (championSide) {
        getRatingMatchSidePlayers(finalMatch, championSide).forEach((player) => {
          ratingEvents.push({
            type: "bonus",
            date: bonusDate,
            order: 1,
            player,
            bonus: TOURNAMENT_BONUSES.champion,
          });
        });
      } else {
        ratingEvents.push({
          type: "bonus",
          date: bonusDate,
          order: 1,
          player: finalMatch.winner,
          bonus: TOURNAMENT_BONUSES.champion,
        });
      }

      if (finalistSide) {
        getRatingMatchSidePlayers(finalMatch, finalistSide).forEach((player) => {
          ratingEvents.push({
            type: "bonus",
            date: bonusDate,
            order: 2,
            player,
            bonus: TOURNAMENT_BONUSES.finalist,
          });
        });
      }
    }

    if (thirdPlaceMatch?.winner) {
      const thirdPlaceSide = thirdPlaceMatch.winnerId === thirdPlaceMatch.player1Id ? 1 : thirdPlaceMatch.winnerId === thirdPlaceMatch.player2Id ? 2 : null;
      if (thirdPlaceSide) {
        getRatingMatchSidePlayers(thirdPlaceMatch, thirdPlaceSide).forEach((player) => {
          ratingEvents.push({
            type: "bonus",
            date: bonusDate,
            order: 3,
            player,
            bonus: TOURNAMENT_BONUSES.thirdPlace,
          });
        });
      }
    }
  }

  ratingEvents
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.order - b.order)
    .forEach((event) => {
      if (event.type === "match") {
        applyMatchRating(event.match);
      } else if (event.type === "bonus") {
        applyTournamentBonus(ensurePlayer(rows, event.player), event.bonus);
      } else if (event.type === "reset") {
        const row = rows.get(event.playerId);
        if (row) {
          row.rating = INITIAL_RATING;
          row.matchRating = INITIAL_RATING;
          row.lastRatingChange = 0;
          row.lastRatingChangeAt = event.date;
        }
      } else {
        const row = rows.get(event.playerId);
        if (row) {
          row.rating = Math.max(0, row.rating + event.amount);
          row.lastRatingChange = event.amount;
          row.lastRatingChangeAt = event.date;
        }
      }
    });

  for (const override of ratingSettings.filter((setting) => setting.key.startsWith("ratingOverride:"))) {
    const playerId = override.key.replace("ratingOverride:", "");
    const rating = Number(override.body);
    const row = rows.get(playerId);

    if (row && Number.isFinite(rating)) {
      row.rating = rating;
    }
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      rating: roundToTenths(row.rating),
      matchRating: roundToTenths(row.matchRating),
      lastRatingChange: roundToTenths(row.lastRatingChange),
    }))
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.played - a.played ||
        b.wins - a.wins ||
        b.goalDifference - a.goalDifference ||
        a.playerName.localeCompare(b.playerName),
    );
}


export async function applyTournamentAbsenceRatingPenalty(tournamentId: string) {
  const appliedKey = `${RATING_ABSENCE_PENALTY_APPLIED_PREFIX}${tournamentId}`;
  const existing = await db.siteContent.findUnique({ where: { key: appliedKey }, select: { key: true } });
  if (existing) return { applied: false, penalized: 0 };

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      seasonId: true,
      startsAt: true,
      isTest: true,
      participants: {
        where: { status: { in: [ParticipantStatus.PENDING, ParticipantStatus.CONFIRMED, ParticipantStatus.WAITLIST] } },
        select: {
          userId: true,
          rosterMembers: { where: { status: TeamInviteStatus.ACCEPTED }, select: { userId: true } },
        },
      },
    },
  });

  if (!tournament || tournament.isTest) return { applied: false, penalized: 0 };

  const registeredUserIds = new Set(tournament.participants.flatMap((participant) => [participant.userId, ...participant.rosterMembers.map((member) => member.userId)]));
  const ratings = await getPlayerRatings({ seasonId: tournament.seasonId ?? null });
  const targets = ratings.slice(0, ABSENCE_PENALTY_TOP_LIMIT).filter((player) => !registeredUserIds.has(player.playerId));
  const appliedAt = new Date();

  await db.$transaction([
    ...targets.map((player) =>
      db.siteContent.upsert({
        where: { key: `${RATING_ABSENCE_PENALTY_PREFIX}${tournament.id}:${player.playerId}` },
        create: {
          key: `${RATING_ABSENCE_PENALTY_PREFIX}${tournament.id}:${player.playerId}`,
          body: JSON.stringify({ amount: ABSENCE_PENALTY_AMOUNT, tournamentId: tournament.id, seasonId: tournament.seasonId, startsAt: tournament.startsAt, appliedAt }),
        },
        update: { body: JSON.stringify({ amount: ABSENCE_PENALTY_AMOUNT, tournamentId: tournament.id, seasonId: tournament.seasonId, startsAt: tournament.startsAt, appliedAt }) },
      }),
    ),
    db.siteContent.upsert({
      where: { key: appliedKey },
      create: { key: appliedKey, body: JSON.stringify({ appliedAt, penalized: targets.length }) },
      update: { body: JSON.stringify({ appliedAt, penalized: targets.length }) },
    }),
  ]);

  return { applied: true, penalized: targets.length };
}
