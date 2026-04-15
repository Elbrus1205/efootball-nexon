import { MatchStatus, TournamentStatus, User, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";

const INITIAL_RATING = 500;
const K_FACTOR = 30;
const TOURNAMENT_BONUSES = {
  champion: 80,
  finalist: 40,
  thirdPlace: 20,
};

type RatingPlayer = Pick<User, "id" | "name" | "nickname" | "image">;

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

export async function getPlayerRatings() {
  const [players, matches, completedTournaments, ratingOverrides] = await db.$transaction([
    db.user.findMany({
      where: { role: UserRole.PLAYER, isBanned: false },
      select: { id: true, name: true, nickname: true, image: true },
      orderBy: { createdAt: "asc" },
    }),
    db.match.findMany({
      where: {
        status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED] },
        player1Id: { not: null },
        player2Id: { not: null },
        player1Score: { not: null },
        player2Score: { not: null },
        isPenaltyTiebreak: false,
      },
      include: {
        player1: { select: { id: true, name: true, nickname: true, image: true } },
        player2: { select: { id: true, name: true, nickname: true, image: true } },
      },
      orderBy: [{ finishedAt: "asc" }, { updatedAt: "asc" }, { createdAt: "asc" }],
    }),
    db.tournament.findMany({
      where: { status: TournamentStatus.COMPLETED },
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
            player1: { select: { id: true, name: true, nickname: true, image: true } },
            player2: { select: { id: true, name: true, nickname: true, image: true } },
            winner: { select: { id: true, name: true, nickname: true, image: true } },
          },
          orderBy: [{ round: "desc" }, { matchNumber: "asc" }],
        },
      },
    }),
    db.siteContent.findMany({
      where: { key: { startsWith: "ratingOverride:" } },
      select: { key: true, body: true },
    }),
  ]);

  const rows = new Map<string, PlayerRatingRow>();
  players.forEach((player) => ensurePlayer(rows, player));

  for (const match of matches) {
    if (!match.player1 || !match.player2 || match.player1Score === null || match.player2Score === null) continue;

    const playerOne = ensurePlayer(rows, match.player1);
    const playerTwo = ensurePlayer(rows, match.player2);
    const playerOneExpected = expectedScore(playerOne.matchRating, playerTwo.matchRating);
    const playerTwoExpected = expectedScore(playerTwo.matchRating, playerOne.matchRating);
    const playerOneScore = match.player1Score > match.player2Score ? 1 : match.player1Score === match.player2Score ? 0.5 : 0;
    const playerTwoScore = 1 - playerOneScore;
    const playerOneDelta = K_FACTOR * (playerOneScore - playerOneExpected);
    const playerTwoDelta = K_FACTOR * (playerTwoScore - playerTwoExpected);
    const matchDate = match.finishedAt ?? match.updatedAt ?? match.createdAt;

    playerOne.matchRating += playerOneDelta;
    playerTwo.matchRating += playerTwoDelta;
    playerOne.rating += playerOneDelta;
    playerTwo.rating += playerTwoDelta;
    playerOne.lastRatingChange = playerOneDelta;
    playerTwo.lastRatingChange = playerTwoDelta;
    playerOne.lastRatingChangeAt = matchDate;
    playerTwo.lastRatingChangeAt = matchDate;

    playerOne.played += 1;
    playerTwo.played += 1;
    playerOne.goalsFor += match.player1Score;
    playerOne.goalsAgainst += match.player2Score;
    playerTwo.goalsFor += match.player2Score;
    playerTwo.goalsAgainst += match.player1Score;
    playerOne.goalDifference = playerOne.goalsFor - playerOne.goalsAgainst;
    playerTwo.goalDifference = playerTwo.goalsFor - playerTwo.goalsAgainst;
    playerOne.lastMatchAt = !playerOne.lastMatchAt || matchDate > playerOne.lastMatchAt ? matchDate : playerOne.lastMatchAt;
    playerTwo.lastMatchAt = !playerTwo.lastMatchAt || matchDate > playerTwo.lastMatchAt ? matchDate : playerTwo.lastMatchAt;

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

  for (const tournament of completedTournaments) {
    const mainMatches = tournament.matches.filter((match) => !match.isThirdPlaceMatch);
    const finalMatch = mainMatches[0];
    const thirdPlaceMatch = tournament.matches.find((match) => match.isThirdPlaceMatch);

    if (finalMatch?.winner) {
      applyTournamentBonus(ensurePlayer(rows, finalMatch.winner), TOURNAMENT_BONUSES.champion);

      const finalist = finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player2 : finalMatch.player1;
      if (finalist) applyTournamentBonus(ensurePlayer(rows, finalist), TOURNAMENT_BONUSES.finalist);
    }

    if (thirdPlaceMatch?.winner) {
      applyTournamentBonus(ensurePlayer(rows, thirdPlaceMatch.winner), TOURNAMENT_BONUSES.thirdPlace);
    }
  }

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
      rating: Math.round(row.rating),
      matchRating: Math.round(row.matchRating),
      lastRatingChange: Math.round(row.lastRatingChange),
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
