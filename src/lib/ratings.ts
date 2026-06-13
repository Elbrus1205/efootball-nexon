import { MatchStatus, Prisma, TournamentStatus, User, UserRole, type ProfileStatusTone, type ProfileStatusType } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { getSelectedProfileStatusWhere } from "@/lib/profile-status-query";

const INITIAL_RATING = 500;
const K_FACTOR = 30;
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

function matchDate(match: { finishedAt?: Date | null; updatedAt: Date; createdAt: Date }) {
  return match.finishedAt ?? match.updatedAt ?? match.createdAt;
}

export async function getPlayerRatings(options: PlayerRatingOptions = {}) {
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

  const [players, matches, completedTournaments, ratingOverrides] = await db.$transaction([
    db.user.findMany({
      where: { role: UserRole.PLAYER, isBanned: false },
      select: {
        id: true,
        name: true,
        image: true,
        profileStatuses: {
          where: getSelectedProfileStatusWhere(),
          select: { id: true, title: true, tone: true, type: true, selectedOrder: true },
          orderBy: [{ selectedOrder: "asc" }],
          take: 3,
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.match.findMany({
      where: matchWhere,
      include: {
        player1: { select: { id: true, name: true, image: true } },
        player2: { select: { id: true, name: true, image: true } },
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
            player1: { select: { id: true, name: true, image: true } },
            player2: { select: { id: true, name: true, image: true } },
            winner: { select: { id: true, name: true, image: true } },
          },
          orderBy: [{ round: "desc" }, { matchNumber: "asc" }],
        },
      },
    }),
    db.siteContent.findMany({
      where: options.seasonId ? { key: "__season-rating-overrides-disabled__" } : { key: { startsWith: "ratingOverride:" } },
      select: { key: true, body: true },
    }),
  ]);

  const rows = new Map<string, PlayerRatingRow>();
  players.forEach((player) => ensurePlayer(rows, player));

  function applyMatchRating(match: (typeof matches)[number]) {
    if (!match.player1 || !match.player2 || match.player1Score === null || match.player2Score === null) return;

    const playerOne = ensurePlayer(rows, match.player1);
    const playerTwo = ensurePlayer(rows, match.player2);
    const playerOneRatingBefore = playerOne.rating;
    const playerTwoRatingBefore = playerTwo.rating;
    const playerOneExpected = expectedScore(playerOneRatingBefore, playerTwoRatingBefore);
    const playerTwoExpected = expectedScore(playerTwoRatingBefore, playerOneRatingBefore);
    const playerOneScore = match.player1Score > match.player2Score ? 1 : match.player1Score === match.player2Score ? 0.5 : 0;
    const playerTwoScore = 1 - playerOneScore;
    const playerOneDelta = K_FACTOR * (playerOneScore - playerOneExpected);
    const playerTwoDelta = K_FACTOR * (playerTwoScore - playerTwoExpected);
    const playedAt = matchDate(match);

    playerOne.matchRating = Math.max(0, playerOne.matchRating + playerOneDelta);
    playerTwo.matchRating = Math.max(0, playerTwo.matchRating + playerTwoDelta);
    playerOne.rating = Math.max(0, playerOneRatingBefore + playerOneDelta);
    playerTwo.rating = Math.max(0, playerTwoRatingBefore + playerTwoDelta);
    playerOne.lastRatingChange = playerOneDelta;
    playerTwo.lastRatingChange = playerTwoDelta;
    playerOne.lastRatingChangeAt = playedAt;
    playerTwo.lastRatingChangeAt = playedAt;

    playerOne.played += 1;
    playerTwo.played += 1;
    playerOne.goalsFor += match.player1Score;
    playerOne.goalsAgainst += match.player2Score;
    playerTwo.goalsFor += match.player2Score;
    playerTwo.goalsAgainst += match.player1Score;
    playerOne.goalDifference = playerOne.goalsFor - playerOne.goalsAgainst;
    playerTwo.goalDifference = playerTwo.goalsFor - playerTwo.goalsAgainst;
    playerOne.lastMatchAt = !playerOne.lastMatchAt || playedAt > playerOne.lastMatchAt ? playedAt : playerOne.lastMatchAt;
    playerTwo.lastMatchAt = !playerTwo.lastMatchAt || playedAt > playerTwo.lastMatchAt ? playedAt : playerTwo.lastMatchAt;

    if (playerOneScore === 1) {
      playerOne.wins += 1;
      playerTwo.losses += 1;
    } else if (playerOneScore === 0) {
      playerTwo.wins += 1;
      playerOne.losses += 1;
    } else {
      playerOne.draws += 1;
      playerTwo.draws += 1;
    }
  }

  const ratingEvents: Array<
    | { type: "match"; date: Date; order: number; match: (typeof matches)[number] }
    | { type: "bonus"; date: Date; order: number; player: RatingPlayer; bonus: number }
  > = matches.map((match) => ({ type: "match", date: matchDate(match), order: 0, match }));

  for (const tournament of completedTournaments) {
    const mainMatches = tournament.matches.filter((match) => !match.isThirdPlaceMatch);
    const finalMatch = mainMatches[0];
    const thirdPlaceMatch = tournament.matches.find((match) => match.isThirdPlaceMatch);
    const bonusDate = tournament.endsAt ?? (finalMatch ? matchDate(finalMatch) : tournament.updatedAt);

    if (finalMatch?.winner) {
      ratingEvents.push({
        type: "bonus",
        date: bonusDate,
        order: 1,
        player: finalMatch.winner,
        bonus: TOURNAMENT_BONUSES.champion,
      });

      const finalist = finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player2 : finalMatch.player1;
      if (finalist) {
        ratingEvents.push({
          type: "bonus",
          date: bonusDate,
          order: 2,
          player: finalist,
          bonus: TOURNAMENT_BONUSES.finalist,
        });
      }
    }

    if (thirdPlaceMatch?.winner) {
      ratingEvents.push({
        type: "bonus",
        date: bonusDate,
        order: 3,
        player: thirdPlaceMatch.winner,
        bonus: TOURNAMENT_BONUSES.thirdPlace,
      });
    }
  }

  ratingEvents
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.order - b.order)
    .forEach((event) => {
      if (event.type === "match") {
        applyMatchRating(event.match);
      } else {
        applyTournamentBonus(ensurePlayer(rows, event.player), event.bonus);
      }
    });

  for (const override of ratingOverrides) {
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

