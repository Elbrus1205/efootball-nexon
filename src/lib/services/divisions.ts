import { DivisionMatchResult, DivisionMatchStatus, DivisionSeasonStatus } from "@prisma/client";
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

export function getDivisionMatchLimit(division: number) {
  if (division === 5) return 15;
  if (division === 4) return 18;
  if (division === 3) return 22;
  return 10;
}

export function isDivisionAdminRole(role?: string | null) {
  return role === "FOUNDER" || role === "ADMIN" || role === "ORGANIZER";
}

export async function getDivisionSettings() {
  await syncDivisionSeasons();
  return db.divisionSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", betaEnabled: true },
  });
}

function divisionSeasonStatusForDates(startsAt: Date, endsAt: Date, now = new Date()) {
  if (now < startsAt) return DivisionSeasonStatus.SCHEDULED;
  if (now > endsAt) return DivisionSeasonStatus.FINISHED;
  return DivisionSeasonStatus.ACTIVE;
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

type DivisionStatsPlayer = {
  userId: string;
  division: number;
  wins: number;
  draws: number;
  losses: number;
};

async function getRatingDivisionStats(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds));
  const stats = new Map<string, { wins: number; draws: number; losses: number }>();
  uniqueUserIds.forEach((userId) => stats.set(userId, { wins: 0, draws: 0, losses: 0 }));

  if (!uniqueUserIds.length) return stats;

  const rows = await db.divisionMatchHistory.groupBy({
    by: ["playerId", "result"],
    where: {
      playerId: { in: uniqueUserIds },
      divisionBefore: { in: [1, 2] },
    },
    _count: { _all: true },
  });

  rows.forEach((row) => {
    const current = stats.get(row.playerId) ?? { wins: 0, draws: 0, losses: 0 };
    if (row.result === DivisionMatchResult.WIN) current.wins = row._count._all;
    if (row.result === DivisionMatchResult.DRAW) current.draws = row._count._all;
    if (row.result === DivisionMatchResult.LOSS) current.losses = row._count._all;
    stats.set(row.playerId, current);
  });

  return stats;
}

async function applyDivisionDisplayStats<T extends DivisionStatsPlayer>(players: T[]) {
  const ratingDivisionPlayers = players.filter((player) => player.division <= 2);
  if (!ratingDivisionPlayers.length) return players;

  const statsByUserId = await getRatingDivisionStats(ratingDivisionPlayers.map((player) => player.userId));
  return players.map((player) => {
    if (player.division > 2) return player;
    const stats = statsByUserId.get(player.userId) ?? { wins: 0, draws: 0, losses: 0 };
    return {
      ...player,
      wins: stats.wins,
      draws: stats.draws,
      losses: stats.losses,
    };
  });
}

export async function getDivisionPlayerForDisplay(userId: string) {
  const profile = await ensureDivisionPlayer(userId);
  const [profileForDisplay] = await applyDivisionDisplayStats([profile]);
  return profileForDisplay;
}

async function updateDivisionSettingsFromSeason(season: { startsAt: Date; endsAt: Date } | null, betaEnabled?: boolean) {
  await db.divisionSettings.upsert({
    where: { id: "default" },
    update: {
      ...(betaEnabled === undefined ? {} : { betaEnabled }),
      phaseStartsAt: season?.startsAt ?? null,
      phaseEndsAt: season?.endsAt ?? null,
    },
    create: {
      id: "default",
      betaEnabled: betaEnabled ?? true,
      phaseStartsAt: season?.startsAt ?? null,
      phaseEndsAt: season?.endsAt ?? null,
    },
  });
}

async function archiveDivisionSeason(seasonId: string) {
  const players = await db.divisionPlayer.findMany({
    orderBy: [{ division: "asc" }, { rating: "desc" }, { points: "desc" }, { wins: "desc" }, { losses: "asc" }, { updatedAt: "asc" }],
  });

  await db.divisionSeasonArchive.createMany({
    data: players.map((player, index) => ({
      seasonId,
      userId: player.userId,
      division: player.division,
      points: player.points,
      rating: player.rating,
      wins: player.wins,
      draws: player.draws,
      losses: player.losses,
      winStreak: player.winStreak,
      bestWinStreak: player.bestWinStreak,
      place: index + 1,
    })),
    skipDuplicates: true,
  });
}

async function finishOtherActiveSeasons(exceptSeasonId: string, finishedAt = new Date()) {
  const activeSeasons = await db.divisionSeason.findMany({
    where: { status: DivisionSeasonStatus.ACTIVE, id: { not: exceptSeasonId } },
    select: { id: true },
  });

  for (const season of activeSeasons) {
    await archiveDivisionSeason(season.id);
    await db.divisionSeason.update({
      where: { id: season.id },
      data: { status: DivisionSeasonStatus.FINISHED, finishedAt },
    });
  }
}

export async function syncDivisionSeasons(now = new Date()) {
  const seasons = await db.divisionSeason.findMany({
    where: { status: { in: [DivisionSeasonStatus.SCHEDULED, DivisionSeasonStatus.ACTIVE] } },
    orderBy: { startsAt: "asc" },
  });

  for (const season of seasons) {
    if (season.status === DivisionSeasonStatus.SCHEDULED && now >= season.startsAt && now <= season.endsAt) {
      await finishOtherActiveSeasons(season.id, now);
      await db.$transaction(async (tx) => {
        await tx.divisionSeason.update({
          where: { id: season.id },
          data: { status: DivisionSeasonStatus.ACTIVE, startedAt: season.startedAt ?? now, pausedAt: null },
        });
        await tx.divisionSettings.upsert({
          where: { id: "default" },
          update: { betaEnabled: true, phaseStartsAt: season.startsAt, phaseEndsAt: season.endsAt },
          create: { id: "default", betaEnabled: true, phaseStartsAt: season.startsAt, phaseEndsAt: season.endsAt },
        });
      });
    }

    if (season.status === DivisionSeasonStatus.ACTIVE && now > season.endsAt) {
      await archiveDivisionSeason(season.id);
      await db.divisionSeason.update({
        where: { id: season.id },
        data: { status: DivisionSeasonStatus.FINISHED, finishedAt: now },
      });
      const next = await db.divisionSeason.findFirst({
        where: { status: DivisionSeasonStatus.SCHEDULED, startsAt: { lte: now }, endsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
      });
      await updateDivisionSettingsFromSeason(next, Boolean(next));
    }
  }
}

export async function getActiveDivisionSeason() {
  await syncDivisionSeasons();
  return db.divisionSeason.findFirst({
    where: { status: DivisionSeasonStatus.ACTIVE, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "desc" },
  });
}

export async function createDivisionSeason(params: { name: string; startsAt: Date; endsAt: Date }) {
  const status = divisionSeasonStatusForDates(params.startsAt, params.endsAt);
  const season = await db.divisionSeason.create({
    data: {
      name: params.name,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      status,
      startedAt: status === DivisionSeasonStatus.ACTIVE ? new Date() : null,
      finishedAt: status === DivisionSeasonStatus.FINISHED ? new Date() : null,
    },
  });

  if (status === DivisionSeasonStatus.ACTIVE) {
    await finishOtherActiveSeasons(season.id);
    await updateDivisionSettingsFromSeason(season, true);
  }

  return season;
}

export async function updateDivisionSeasonAction(seasonId: string, action: string) {
  const now = new Date();
  const season = await db.divisionSeason.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error("Сезон не найден.");

  if (action === "start" || action === "resume") {
    await finishOtherActiveSeasons(season.id, now);
    const updated = await db.divisionSeason.update({
      where: { id: season.id },
      data: { status: DivisionSeasonStatus.ACTIVE, startedAt: season.startedAt ?? now, pausedAt: null },
    });
    await updateDivisionSettingsFromSeason(updated, true);
    return updated;
  }

  if (action === "pause") {
    const updated = await db.divisionSeason.update({
      where: { id: season.id },
      data: { status: DivisionSeasonStatus.PAUSED, pausedAt: now },
    });
    await updateDivisionSettingsFromSeason(updated, false);
    return updated;
  }

  if (action === "finish") {
    await archiveDivisionSeason(season.id);
    const updated = await db.divisionSeason.update({
      where: { id: season.id },
      data: { status: DivisionSeasonStatus.FINISHED, finishedAt: now },
    });
    await updateDivisionSettingsFromSeason(null, false);
    return updated;
  }

  throw new Error("Неизвестное действие сезона.");
}

export async function clearDivisionSeasons() {
  await db.divisionSeason.deleteMany();
  await updateDivisionSettingsFromSeason(null, false);
}

export async function settleDivisionCycle(userId: string) {
  const profile = await ensureDivisionPlayer(userId);
  if (profile.division <= 2) {
    throw new Error("В рейтинговых дивизионах переход считается по рейтингу.");
  }

  const target = getPromotionTarget(profile.division);
  const totalGames = profile.wins + profile.draws + profile.losses;
  const matchLimit = getDivisionMatchLimit(profile.division);
  const promoted = Boolean(target && profile.points >= target);
  const relegated = !promoted && totalGames >= matchLimit;

  if (!promoted && !relegated) {
    throw new Error("Сначала доиграйте матчи или наберите очки для повышения.");
  }

  const nextDivision = promoted ? profile.division - 1 : Math.min(5, profile.division + 1);
  const nextRating = nextDivision <= 2 ? 1000 : null;
  const updated = await db.divisionPlayer.update({
    where: { userId },
    data: {
      division: nextDivision,
      points: 0,
      rating: nextRating,
      wins: 0,
      draws: 0,
      losses: 0,
      winStreak: 0,
      bestWinStreak: 0,
    },
  });

  return { player: updated, promoted, relegated, stayed: !promoted && nextDivision === profile.division };
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
  const activeSeason = await getActiveDivisionSeason();
  if (!activeSeason) {
    throw new Error("Сезон дивизионов сейчас не активен.");
  }
  const profile = await ensureDivisionPlayer(userId);
  const target = getPromotionTarget(profile.division);
  const totalGames = profile.wins + profile.draws + profile.losses;
  if (profile.division > 2 && ((target && profile.points >= target) || totalGames >= getDivisionMatchLimit(profile.division))) {
    throw new Error("Сначала завершите цикл дивизиона.");
  }
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

export async function getDivisionLeaderboard(params?: { page?: number; aroundUserId?: string; division?: number }) {
  const pageSize = 10;
  const where = params?.division ? { division: params.division } : {};
  const total = await db.divisionPlayer.count({ where });
  let page = Math.max(1, params?.page ?? 1);

  if (params?.aroundUserId) {
    const all = await db.divisionPlayer.findMany({
      where,
      orderBy: [{ division: "asc" }, { rating: "desc" }, { points: "desc" }, { wins: "desc" }, { losses: "asc" }, { updatedAt: "asc" }],
      select: { userId: true },
    });
    const index = all.findIndex((item) => item.userId === params.aroundUserId);
    if (index >= 0) page = Math.floor(index / pageSize) + 1;
  }

  const players = await db.divisionPlayer.findMany({
    where,
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
    players: await applyDivisionDisplayStats(players),
    page,
    total,
    pageSize,
    from: total ? (page - 1) * pageSize + 1 : 0,
    to: Math.min(page * pageSize, total),
  };
}
