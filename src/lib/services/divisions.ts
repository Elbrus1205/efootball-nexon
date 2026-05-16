import { DivisionMatchResult, DivisionMatchStatus } from "@prisma/client";
import { db } from "@/lib/db";

export const DIVISION_MATCH_DEADLINE_HOURS = 24;

export function getDivisionGroup(division: number) {
  return division <= 2 ? 1 : 2;
}

export function getDivisionLabel(division: number) {
  return `Дивизион ${division}`;
}

export function getPromotionTarget(division: number) {
  if (division === 5) return 30;
  if (division === 4) return 45;
  if (division === 3) return 60;
  if (division === 2) return 1500;
  return null;
}

export function isDivisionAdminRole(role?: string | null) {
  return role === "FOUNDER" || role === "ADMIN" || role === "ORGANIZER";
}

export async function getDivisionSettings() {
  return db.divisionSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", betaEnabled: true },
  });
}

export async function ensureDivisionPlayer(userId: string) {
  return db.divisionPlayer.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      division: 5,
      points: 0,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          telegramUsername: true,
          image: true,
        },
      },
    },
  });
}

export function getDivisionScore(scoreFor: number, scoreAgainst: number): DivisionMatchResult {
  if (scoreFor > scoreAgainst) return DivisionMatchResult.WIN;
  if (scoreFor < scoreAgainst) return DivisionMatchResult.LOSS;
  return DivisionMatchResult.DRAW;
}

function getPointsDelta(result: DivisionMatchResult) {
  if (result === DivisionMatchResult.WIN) return 3;
  if (result === DivisionMatchResult.DRAW) return 1;
  return 0;
}

function getEloDelta(playerRating: number, opponentRating: number, result: DivisionMatchResult) {
  const actual = result === DivisionMatchResult.WIN ? 1 : result === DivisionMatchResult.DRAW ? 0.5 : 0;
  const expected = 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
  return Math.round(32 * (actual - expected));
}

function applyPromotionRules(params: {
  division: number;
  points: number;
  rating: number | null;
}) {
  let division = params.division;
  let points = params.points;
  let rating = params.rating;

  if (division === 5 && points >= 30) {
    division = 4;
    points = 0;
  }
  if (division === 4 && points >= 45) {
    division = 3;
    points = 0;
  }
  if (division === 3 && points >= 60) {
    division = 2;
    points = 0;
    rating = 1000;
  }

  if (division === 2 && (rating ?? 1000) > 1500) {
    division = 1;
  }
  if (division === 1 && (rating ?? 1000) < 900) {
    division = 2;
  } else if (division === 2 && (rating ?? 1000) < 900) {
    division = 3;
    points = 0;
    rating = null;
  }

  return { division, points, rating };
}

function randomAutoScore() {
  const first = Math.floor(Math.random() * 5);
  const second = Math.floor(Math.random() * 5);
  return first === second && Math.random() > 0.68 ? [first + 1, second] : [first, second];
}

export async function autoResolveExpiredDivisionMatches() {
  const expired = await db.divisionMatch.findMany({
    where: {
      status: { in: [DivisionMatchStatus.WAITING_GAME, DivisionMatchStatus.WAITING_CONFIRMATION] },
      deadlineAt: { lt: new Date() },
    },
    select: { id: true },
    take: 25,
  });

  for (const match of expired) {
    const [playerOneScore, playerTwoScore] = randomAutoScore();
    await finishDivisionMatch(match.id, playerOneScore, playerTwoScore, { autoResolved: true }).catch(() => null);
  }
}

export async function enterDivisionQueue(userId: string) {
  await autoResolveExpiredDivisionMatches();
  const profile = await ensureDivisionPlayer(userId);
  const group = getDivisionGroup(profile.division);

  const activeMatch = await db.divisionMatch.findFirst({
    where: {
      status: { in: [DivisionMatchStatus.WAITING_GAME, DivisionMatchStatus.WAITING_CONFIRMATION, DivisionMatchStatus.DISPUTED] },
      OR: [{ playerOneId: userId }, { playerTwoId: userId }],
    },
  });

  if (activeMatch) {
    return { status: "active-match" as const, match: activeMatch };
  }

  const opponent = await db.divisionQueueEntry.findFirst({
    where: {
      group,
      userId: { not: userId },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!opponent) {
    const queue = await db.divisionQueueEntry.upsert({
      where: { userId },
      update: { group, createdAt: new Date() },
      create: { userId, group },
    });
    return { status: "queued" as const, queue };
  }

  const match = await db.$transaction(async (tx) => {
    await tx.divisionQueueEntry.deleteMany({
      where: { userId: { in: [userId, opponent.userId] } },
    });

    return tx.divisionMatch.create({
      data: {
        playerOneId: opponent.userId,
        playerTwoId: userId,
        deadlineAt: new Date(Date.now() + DIVISION_MATCH_DEADLINE_HOURS * 60 * 60 * 1000),
      },
    });
  });

  return { status: "matched" as const, match };
}

export async function leaveDivisionQueue(userId: string) {
  await db.divisionQueueEntry.deleteMany({ where: { userId } });
}

export async function submitDivisionScore(params: {
  matchId: string;
  userId: string;
  playerOneScore: number;
  playerTwoScore: number;
  screenshotUrl?: string | null;
}) {
  await autoResolveExpiredDivisionMatches();
  const match = await db.divisionMatch.findUnique({
    where: { id: params.matchId },
    include: { submissions: true },
  });

  if (!match || (match.playerOneId !== params.userId && match.playerTwoId !== params.userId)) {
    throw new Error("Матч не найден.");
  }
  if (
    match.status !== DivisionMatchStatus.WAITING_GAME &&
    match.status !== DivisionMatchStatus.WAITING_CONFIRMATION &&
    match.status !== DivisionMatchStatus.DISPUTED
  ) {
    throw new Error("Для этого матча уже нельзя отправить счет.");
  }

  await db.divisionScoreSubmission.upsert({
    where: {
      matchId_submittedById: {
        matchId: match.id,
        submittedById: params.userId,
      },
    },
    update: {
      playerOneScore: params.playerOneScore,
      playerTwoScore: params.playerTwoScore,
      screenshotUrl: params.screenshotUrl || null,
    },
    create: {
      matchId: match.id,
      submittedById: params.userId,
      playerOneScore: params.playerOneScore,
      playerTwoScore: params.playerTwoScore,
      screenshotUrl: params.screenshotUrl || null,
    },
  });

  const submissions = await db.divisionScoreSubmission.findMany({
    where: { matchId: match.id },
    orderBy: { createdAt: "asc" },
  });

  if (submissions.length < 2) {
    return db.divisionMatch.update({
      where: { id: match.id },
      data: { status: DivisionMatchStatus.WAITING_CONFIRMATION },
    });
  }

  const [first, second] = submissions;
  if (first.playerOneScore === second.playerOneScore && first.playerTwoScore === second.playerTwoScore) {
    return finishDivisionMatch(match.id, first.playerOneScore, first.playerTwoScore);
  }

  return db.divisionMatch.update({
    where: { id: match.id },
    data: { status: DivisionMatchStatus.DISPUTED },
  });
}

export async function finishDivisionMatch(
  matchId: string,
  playerOneScore: number,
  playerTwoScore: number,
  options?: { autoResolved?: boolean; adminNote?: string | null },
) {
  const match = await db.divisionMatch.findUnique({
    where: { id: matchId },
  });
  if (!match) throw new Error("Матч не найден.");
  if (match.status === DivisionMatchStatus.FINISHED) return match;

  const one = await ensureDivisionPlayer(match.playerOneId);
  const two = await ensureDivisionPlayer(match.playerTwoId);
  const oneResult = getDivisionScore(playerOneScore, playerTwoScore);
  const twoResult = getDivisionScore(playerTwoScore, playerOneScore);
  const oneBefore = { division: one.division, points: one.points, rating: one.rating };
  const twoBefore = { division: two.division, points: two.points, rating: two.rating };
  const oneUsesRating = one.division <= 2;
  const twoUsesRating = two.division <= 2;
  const oneDelta = oneUsesRating ? getEloDelta(one.rating ?? 1000, two.rating ?? 1000, oneResult) : getPointsDelta(oneResult);
  const twoDelta = twoUsesRating ? getEloDelta(two.rating ?? 1000, one.rating ?? 1000, twoResult) : getPointsDelta(twoResult);
  const oneNextRaw = oneUsesRating
    ? { division: one.division, points: one.points, rating: Math.max(0, (one.rating ?? 1000) + oneDelta) }
    : { division: one.division, points: one.points + oneDelta, rating: one.rating };
  const twoNextRaw = twoUsesRating
    ? { division: two.division, points: two.points, rating: Math.max(0, (two.rating ?? 1000) + twoDelta) }
    : { division: two.division, points: two.points + twoDelta, rating: two.rating };
  const oneNext = applyPromotionRules(oneNextRaw);
  const twoNext = applyPromotionRules(twoNextRaw);

  return db.$transaction(async (tx) => {
    await tx.divisionPlayer.update({
      where: { userId: one.userId },
      data: {
        division: oneNext.division,
        points: oneNext.points,
        rating: oneNext.rating,
        wins: { increment: oneResult === DivisionMatchResult.WIN ? 1 : 0 },
        draws: { increment: oneResult === DivisionMatchResult.DRAW ? 1 : 0 },
        losses: { increment: oneResult === DivisionMatchResult.LOSS ? 1 : 0 },
        winStreak: oneResult === DivisionMatchResult.WIN ? one.winStreak + 1 : 0,
        bestWinStreak: oneResult === DivisionMatchResult.WIN ? Math.max(one.bestWinStreak, one.winStreak + 1) : one.bestWinStreak,
      },
    });

    await tx.divisionPlayer.update({
      where: { userId: two.userId },
      data: {
        division: twoNext.division,
        points: twoNext.points,
        rating: twoNext.rating,
        wins: { increment: twoResult === DivisionMatchResult.WIN ? 1 : 0 },
        draws: { increment: twoResult === DivisionMatchResult.DRAW ? 1 : 0 },
        losses: { increment: twoResult === DivisionMatchResult.LOSS ? 1 : 0 },
        winStreak: twoResult === DivisionMatchResult.WIN ? two.winStreak + 1 : 0,
        bestWinStreak: twoResult === DivisionMatchResult.WIN ? Math.max(two.bestWinStreak, two.winStreak + 1) : two.bestWinStreak,
      },
    });

    await tx.divisionMatch.update({
      where: { id: match.id },
      data: {
        playerOneScore,
        playerTwoScore,
        status: DivisionMatchStatus.FINISHED,
        finishedAt: new Date(),
        autoResolved: Boolean(options?.autoResolved),
        adminNote: options?.adminNote ?? match.adminNote,
      },
    });

    await tx.divisionMatchHistory.createMany({
      data: [
        {
          matchId: match.id,
          playerId: one.userId,
          opponentId: two.userId,
          result: oneResult,
          playerScore: playerOneScore,
          opponentScore: playerTwoScore,
          divisionBefore: oneBefore.division,
          divisionAfter: oneNext.division,
          pointsBefore: oneBefore.points,
          pointsAfter: oneNext.points,
          ratingBefore: oneBefore.rating,
          ratingAfter: oneNext.rating,
          delta: oneDelta,
        },
        {
          matchId: match.id,
          playerId: two.userId,
          opponentId: one.userId,
          result: twoResult,
          playerScore: playerTwoScore,
          opponentScore: playerOneScore,
          divisionBefore: twoBefore.division,
          divisionAfter: twoNext.division,
          pointsBefore: twoBefore.points,
          pointsAfter: twoNext.points,
          ratingBefore: twoBefore.rating,
          ratingAfter: twoNext.rating,
          delta: twoDelta,
        },
      ],
      skipDuplicates: true,
    });

    return tx.divisionMatch.findUniqueOrThrow({
      where: { id: match.id },
      include: { history: true },
    });
  });
}

export async function cancelDivisionMatch(matchId: string, adminNote?: string | null) {
  return db.divisionMatch.update({
    where: { id: matchId },
    data: {
      status: DivisionMatchStatus.CANCELLED,
      adminNote,
    },
  });
}

export async function getDivisionLeaderboard(params?: { page?: number; aroundUserId?: string }) {
  const pageSize = 10;
  const total = await db.divisionPlayer.count();
  let page = Math.max(1, params?.page ?? 1);

  if (params?.aroundUserId) {
    const all = await db.divisionPlayer.findMany({
      orderBy: [{ division: "asc" }, { rating: "desc" }, { points: "desc" }, { wins: "desc" }, { losses: "asc" }, { updatedAt: "asc" }],
      select: { userId: true },
    });
    const index = all.findIndex((item) => item.userId === params.aroundUserId);
    if (index >= 0) page = Math.floor(index / pageSize) + 1;
  }

  const players = await db.divisionPlayer.findMany({
    orderBy: [{ division: "asc" }, { rating: "desc" }, { points: "desc" }, { wins: "desc" }, { losses: "asc" }, { updatedAt: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          telegramUsername: true,
        },
      },
    },
  });

  return {
    players,
    page,
    total,
    pageSize,
    from: total ? (page - 1) * pageSize + 1 : 0,
    to: Math.min(page * pageSize, total),
  };
}
