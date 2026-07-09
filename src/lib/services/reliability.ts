import { NotificationType, ReliabilityEventType, ReliabilityPenaltyScope } from "@prisma/client";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";

export const RELIABILITY_MAX_SCORE = 100;
export const RELIABILITY_REGISTRATION_THRESHOLD = 70;
export const RELIABILITY_RECOVERY_SCORE_CAP = 80;
export const RELIABILITY_RESTRICTION_DAYS = 30;

const dayMs = 24 * 60 * 60 * 1000;
const technicalLossTypes: ReliabilityEventType[] = [
  ReliabilityEventType.TECHNICAL_LOSS,
  ReliabilityEventType.TECHNICAL_LOSS_REPEAT,
  ReliabilityEventType.REPLACEMENT_FORFEIT,
];

type ReliabilityUser = {
  id: string;
  reliabilityScore: number;
  reliabilityRestrictedUntil: Date | null;
  reliabilityConfirmStreak: number;
  reliabilityCleanMatchStreak: number;
};

type ReliabilityEventInput = {
  userId: string;
  type: ReliabilityEventType;
  delta: number;
  reason: string;
  comment?: string | null;
  actorId?: string | null;
  matchId?: string | null;
  tournamentId?: string | null;
  dedupeKey?: string | null;
  notify?: boolean;
};

const eventTypeByPenaltyScope: Record<ReliabilityPenaltyScope, ReliabilityEventType> = {
  SCORE_SUBMISSION: ReliabilityEventType.DISPUTE_FALSE_SCORE,
  PLAYER_REPLACEMENT: ReliabilityEventType.REPLACEMENT_CIRCUMSTANCES,
  TECHNICAL_LOSS: ReliabilityEventType.TECHNICAL_LOSS,
};

export function clampReliabilityScore(score: number) {
  return Math.min(RELIABILITY_MAX_SCORE, Math.max(0, score));
}

export function getReliabilityStatus(score: number) {
  if (score >= 90) return { label: "Отличная", tone: "excellent" as const };
  if (score >= 80) return { label: "Хорошая", tone: "good" as const };
  if (score >= RELIABILITY_REGISTRATION_THRESHOLD) return { label: "Допущен", tone: "allowed" as const };
  return { label: "Ограничен", tone: "restricted" as const };
}

export function isReliabilityRestricted(user: Pick<ReliabilityUser, "reliabilityScore" | "reliabilityRestrictedUntil">, now = new Date()) {
  return user.reliabilityScore < RELIABILITY_REGISTRATION_THRESHOLD || Boolean(user.reliabilityRestrictedUntil && user.reliabilityRestrictedUntil > now);
}

export function formatReliabilityRegistrationRestriction(user: Pick<ReliabilityUser, "reliabilityScore" | "reliabilityRestrictedUntil"> | null) {
  if (!user || !isReliabilityRestricted(user)) return null;

  const date =
    user.reliabilityRestrictedUntil && user.reliabilityRestrictedUntil > new Date()
      ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(user.reliabilityRestrictedUntil)
      : null;

  return date
    ? `Регистрация в турниры временно закрыта: надежность ${user.reliabilityScore}/100. Ограничение действует до ${date}.`
    : `Регистрация в турниры временно закрыта: надежность ${user.reliabilityScore}/100. Минимум для участия — 70.`;
}

export async function syncReliabilityRestriction(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      reliabilityScore: true,
      reliabilityRestrictedUntil: true,
      reliabilityConfirmStreak: true,
      reliabilityCleanMatchStreak: true,
    },
  });

  if (!user || !user.reliabilityRestrictedUntil || user.reliabilityRestrictedUntil > new Date()) {
    return user;
  }

  const recovered = await applyReliabilityEvent({
    userId,
    type: ReliabilityEventType.RESTRICTION_RECOVERY,
    delta: RELIABILITY_RECOVERY_SCORE_CAP,
    reason: "30 дней ограничения прошли. Надежность восстановлена для повторного допуска.",
    dedupeKey: `restriction-recovery:${user.reliabilityRestrictedUntil.toISOString()}`,
  });

  return recovered.user;
}

export async function applyReliabilityEvent(input: ReliabilityEventInput) {
  const result = await db.$transaction(async (tx) => {
    if (input.dedupeKey) {
      const existing = await tx.reliabilityEvent.findUnique({
        where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
      });

      if (existing) {
        const existingUser = await tx.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            reliabilityScore: true,
            reliabilityRestrictedUntil: true,
            reliabilityConfirmStreak: true,
            reliabilityCleanMatchStreak: true,
          },
        });

        return { event: existing, user: existingUser, created: false };
      }
    }

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        reliabilityScore: true,
        reliabilityRestrictedUntil: true,
        reliabilityConfirmStreak: true,
        reliabilityCleanMatchStreak: true,
      },
    });

    if (!user) {
      throw new Error("Reliability user not found");
    }

    const scoreBefore = user.reliabilityScore;
    const scoreAfter = resolveScoreAfter(scoreBefore, input);
    const restrictedUntil = resolveRestrictedUntil(scoreBefore, scoreAfter, user.reliabilityRestrictedUntil);
    const resetsStreaks = input.delta < 0 || technicalLossTypes.includes(input.type);

    const updatedUser = await tx.user.update({
      where: { id: input.userId },
      data: {
        reliabilityScore: scoreAfter,
        reliabilityRestrictedUntil: restrictedUntil,
        reliabilityConfirmStreak: resetsStreaks ? 0 : undefined,
        reliabilityCleanMatchStreak: resetsStreaks ? 0 : undefined,
      },
      select: {
        id: true,
        reliabilityScore: true,
        reliabilityRestrictedUntil: true,
        reliabilityConfirmStreak: true,
        reliabilityCleanMatchStreak: true,
      },
    });

    const event = await tx.reliabilityEvent.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? null,
        type: input.type,
        delta: scoreAfter - scoreBefore,
        scoreBefore,
        scoreAfter,
        reason: input.reason,
        comment: input.comment ?? null,
        dedupeKey: input.dedupeKey ?? null,
        matchId: input.matchId ?? null,
        tournamentId: input.tournamentId ?? null,
      },
    });

    return { event, user: updatedUser, created: true };
  });

  if (result.created && result.user && input.notify !== false) {
    await sendReliabilityNotification(result.user, result.event.reason, result.event.delta).catch((error) => {
      console.error("Failed to send reliability notification", error);
    });
  }

  return result;
}

export async function getReliabilityPenaltyReasons(scope?: ReliabilityPenaltyScope, activeOnly = true) {
  return db.reliabilityPenaltyReason.findMany({
    where: {
      scope,
      isActive: activeOnly ? true : undefined,
    },
    orderBy: [{ scope: "asc" }, { points: "desc" }, { createdAt: "asc" }],
  });
}

export async function applyConfiguredReliabilityPenalty({
  reasonId,
  scope,
  userId,
  actorId,
  matchId,
  tournamentId,
  dedupeKey,
  comment,
}: {
  reasonId?: string | null;
  scope: ReliabilityPenaltyScope;
  userId: string;
  actorId?: string | null;
  matchId?: string | null;
  tournamentId?: string | null;
  dedupeKey?: string | null;
  comment?: string | null;
}) {
  const normalizedReasonId = reasonId?.trim();
  if (!normalizedReasonId) return null;

  const reason = await db.reliabilityPenaltyReason.findFirst({
    where: {
      id: normalizedReasonId,
      scope,
      isActive: true,
    },
  });

  if (!reason) {
    throw new Error("RELIABILITY_PENALTY_REASON_NOT_FOUND");
  }

  const points = Math.max(0, Math.abs(reason.points));
  if (points === 0) return null;

  return applyReliabilityEvent({
    userId,
    type: eventTypeByPenaltyScope[scope],
    delta: -points,
    reason: `${reason.title}: -${points} к надежности.`,
    comment: [reason.description, comment].filter(Boolean).join("\n") || null,
    actorId,
    matchId,
    tournamentId,
    dedupeKey,
  });
}

export async function applyConfiguredReliabilityPenaltyToUsers({
  reasonId,
  scope,
  userIds,
  actorId,
  matchId,
  tournamentId,
  dedupeKeyForUserId,
  comment,
}: {
  reasonId?: string | null;
  scope: ReliabilityPenaltyScope;
  userIds: string[];
  actorId?: string | null;
  matchId?: string | null;
  tournamentId?: string | null;
  dedupeKeyForUserId: (userId: string) => string;
  comment?: string | null;
}) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const results = [];

  for (const userId of uniqueUserIds) {
    results.push(
      await applyConfiguredReliabilityPenalty({
        reasonId,
        scope,
        userId,
        actorId,
        matchId,
        tournamentId,
        dedupeKey: dedupeKeyForUserId(userId),
        comment,
      }),
    );
  }

  return results;
}

export async function removeConfiguredReliabilityPenaltiesByPrefix(dedupeKeyPrefix: string) {
  const normalizedPrefix = dedupeKeyPrefix.trim();
  if (!normalizedPrefix) return { removed: 0 };

  const result = await db.$transaction(async (tx) => {
    const events = await tx.reliabilityEvent.findMany({
      where: {
        dedupeKey: { startsWith: normalizedPrefix },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const event of events) {
      const user = await tx.user.findUnique({
        where: { id: event.userId },
        select: {
          reliabilityScore: true,
          reliabilityRestrictedUntil: true,
        },
      });

      if (!user) continue;

      const scoreAfterRemoval = clampReliabilityScore(user.reliabilityScore - event.delta);
      await tx.user.update({
        where: { id: event.userId },
        data: {
          reliabilityScore: scoreAfterRemoval,
          reliabilityRestrictedUntil: scoreAfterRemoval >= RELIABILITY_REGISTRATION_THRESHOLD ? null : user.reliabilityRestrictedUntil,
        },
      });
    }

    if (events.length) {
      await tx.reliabilityEvent.deleteMany({
        where: {
          id: { in: events.map((event) => event.id) },
        },
      });
    }

    return { removed: events.length };
  });

  return result;
}

export async function applyTechnicalLossPenalty({
  userId,
  matchId,
  tournamentId,
  actorId,
  dedupeKey,
  reason = "Техническое поражение снижает надежность игрока.",
}: {
  userId: string;
  matchId?: string | null;
  tournamentId?: string | null;
  actorId?: string | null;
  dedupeKey: string;
  reason?: string;
}) {
  const since = new Date(Date.now() - 30 * dayMs);
  const recentTechnicalLosses = await db.reliabilityEvent.count({
    where: {
      userId,
      type: { in: technicalLossTypes },
      createdAt: { gte: since },
    },
  });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { reliabilityScore: true },
  });

  const isRepeat = recentTechnicalLosses >= 1;
  const delta = isRepeat && user && user.reliabilityScore < 80 ? -10 : isRepeat ? 80 : -8;

  return applyReliabilityEvent({
    userId,
    type: isRepeat ? ReliabilityEventType.TECHNICAL_LOSS_REPEAT : ReliabilityEventType.TECHNICAL_LOSS,
    delta,
    reason: isRepeat ? "Второе техническое поражение за 30 дней: надежность снижена по повторному штрафу." : reason,
    actorId,
    matchId,
    tournamentId,
    dedupeKey,
  });
}

export async function recordConfirmedMatchReliability({
  userIds,
  matchId,
  tournamentId,
}: {
  userIds: Array<string | null>;
  matchId: string;
  tournamentId: string;
}) {
  const uniqueUserIds = Array.from(new Set(userIds.filter((userId): userId is string => Boolean(userId))));

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const confirmationDedupeKey = `match-confirmed:${matchId}`;
      const existingConfirmation = await db.reliabilityEvent.findUnique({
        where: { userId_dedupeKey: { userId, dedupeKey: confirmationDedupeKey } },
      });

      if (existingConfirmation) return;

      const updated = await db.user.update({
        where: { id: userId },
        data: {
          reliabilityConfirmStreak: { increment: 1 },
          reliabilityCleanMatchStreak: { increment: 1 },
        },
        select: {
          reliabilityConfirmStreak: true,
          reliabilityCleanMatchStreak: true,
        },
      });

      await applyReliabilityEvent({
        userId,
        type: ReliabilityEventType.RESULT_CONFIRMATION,
        delta: 0,
        reason: "Матч подтвержден без нарушения.",
        matchId,
        tournamentId,
        dedupeKey: confirmationDedupeKey,
        notify: false,
      });

      if (updated.reliabilityConfirmStreak > 0 && updated.reliabilityConfirmStreak % 10 === 0) {
        await applyReliabilityEvent({
          userId,
          type: ReliabilityEventType.CONFIRMATION_STREAK_BONUS,
          delta: 3,
          reason: "10 подтверждений результата подряд без задержек: +3 к надежности.",
          matchId,
          tournamentId,
          dedupeKey: `confirm-streak-bonus:${matchId}`,
        });
      }

      if (updated.reliabilityCleanMatchStreak > 0 && updated.reliabilityCleanMatchStreak % 10 === 0) {
        await applyReliabilityEvent({
          userId,
          type: ReliabilityEventType.CLEAN_MATCH_STREAK_BONUS,
          delta: 4,
          reason: "10 матчей подряд без технических поражений и нарушений: +4 к надежности.",
          matchId,
          tournamentId,
          dedupeKey: `clean-streak-bonus:${matchId}`,
        });
      }
    }),
  );
}

export async function getReliabilitySummary(userId: string) {
  const user = await syncReliabilityRestriction(userId);
  if (!user) return null;

  const recentEvents = await db.reliabilityEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return {
    score: user.reliabilityScore,
    restrictedUntil: user.reliabilityRestrictedUntil,
    confirmStreak: user.reliabilityConfirmStreak,
    cleanMatchStreak: user.reliabilityCleanMatchStreak,
    status: getReliabilityStatus(user.reliabilityScore),
    recentEvents,
  };
}

function resolveScoreAfter(scoreBefore: number, input: ReliabilityEventInput) {
  if (input.type === ReliabilityEventType.RESTRICTION_RECOVERY) {
    return Math.min(RELIABILITY_RECOVERY_SCORE_CAP, clampReliabilityScore(scoreBefore + 10));
  }

  if (input.type === ReliabilityEventType.TECHNICAL_LOSS_REPEAT && input.delta === 80) {
    return 80;
  }

  return clampReliabilityScore(scoreBefore + input.delta);
}

function resolveRestrictedUntil(scoreBefore: number, scoreAfter: number, currentRestrictedUntil: Date | null) {
  const now = new Date();
  const alreadyRestricted = currentRestrictedUntil && currentRestrictedUntil > now;

  if (scoreAfter < RELIABILITY_REGISTRATION_THRESHOLD) {
    return alreadyRestricted ? currentRestrictedUntil : new Date(now.getTime() + RELIABILITY_RESTRICTION_DAYS * dayMs);
  }

  if (scoreBefore < RELIABILITY_REGISTRATION_THRESHOLD && scoreAfter >= RELIABILITY_REGISTRATION_THRESHOLD) {
    return null;
  }

  return currentRestrictedUntil;
}

async function sendReliabilityNotification(user: ReliabilityUser, reason: string, delta: number) {
  const status = getReliabilityStatus(user.reliabilityScore);
  const sign = delta > 0 ? "+" : "";
  const title = delta === 0 ? "Надежность обновлена" : `Надежность ${sign}${delta}`;
  const restrictionText =
    user.reliabilityRestrictedUntil && user.reliabilityRestrictedUntil > new Date()
      ? ` Регистрация в новые турниры ограничена до ${new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(user.reliabilityRestrictedUntil)}.`
      : "";

  await createNotification({
    userId: user.id,
    title,
    body: `${reason} Сейчас: ${user.reliabilityScore}/100, статус: ${status.label}.${restrictionText}`,
    type: NotificationType.SYSTEM,
    link: "/dashboard",
    dedupeWithinHours: 1,
  });
}

export type ReliabilitySummary = NonNullable<Awaited<ReturnType<typeof getReliabilitySummary>>>;
