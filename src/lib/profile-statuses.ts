import { NotificationType, ProfileStatusApprovalStatus, ProfileStatusTone, ProfileStatusType, type UserProfileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlayerRatings } from "@/lib/ratings";
import { createNotification } from "@/lib/services/notifications";
import { MAX_SELECTED_PROFILE_STATUSES } from "@/lib/profile-status-style";

export { MAX_SELECTED_PROFILE_STATUSES };

const GOAL_MASTER_DURATION_MONTHS = 3;
const CURRENT_CHAMPION_DURATION_DAYS = 30;

export const currentChampionProfileStatusDraft = {
  type: ProfileStatusType.CURRENT_CHAMPION,
  title: "Действующий чемпион",
  description: "Победитель актуального завершённого турнира. Действует 30 дней с момента выдачи.",
  tone: ProfileStatusTone.GOLD,
} as const;

export const manualProfileStatusDrafts = [
  {
    type: ProfileStatusType.LEGEND,
    title: "Легенда",
    description: "Особый статус для легендарных игроков сообщества.",
    tone: ProfileStatusTone.PURPLE,
  },
  {
    type: ProfileStatusType.ACTIVE,
    title: "Активный",
    description: "Статус для активных игроков, которые регулярно участвуют в жизни проекта.",
    tone: ProfileStatusTone.GREEN,
  },
  {
    type: ProfileStatusType.RELIABLE,
    title: "Надежный",
    description: "Статус для надежных игроков сообщества.",
    tone: ProfileStatusTone.BLUE,
  },
  {
    type: ProfileStatusType.GOAL_MASTER,
    title: "Goal Master",
    description: "Статус за победу в розыгрыше за красивый гол. Действует 3 месяца с момента выдачи.",
    tone: ProfileStatusTone.PURPLE,
  },
  {
    type: ProfileStatusType.AMBASSADOR,
    title: "Амбассадор",
    description: "Официальный амбассадор eFootball Nexon с подтверждённым YouTube-каналом.",
    tone: ProfileStatusTone.GOLD,
  },
] as const;

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function getCurrentChampionStatusExpiresAt(issuedAt = new Date()) {
  return addDays(issuedAt, CURRENT_CHAMPION_DURATION_DAYS);
}

function getManualProfileStatusExpiresAt(type: ProfileStatusType, issuedAt: Date) {
  if (type !== ProfileStatusType.GOAL_MASTER) return null;
  return addMonths(issuedAt, GOAL_MASTER_DURATION_MONTHS);
}

function formatStatusExpirationDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildProfileStatusGrantedBody(status: Pick<UserProfileStatus, "title" | "expiresAt">) {
  const base = `Администратор выдал вам статус: ${status.title}. Его можно выбрать в редакторе профиля.`;

  if (!status.expiresAt) return base;
  return `${base} Статус действует до ${formatStatusExpirationDate(status.expiresAt)}.`;
}

function buildAutomaticProfileStatusGrantedBody(status: Pick<UserProfileStatus, "title" | "expiresAt">) {
  const base = `Вам выдан статус: ${status.title}. Его можно выбрать в редакторе профиля.`;

  if (!status.expiresAt) return base;
  return `${base} Статус действует до ${formatStatusExpirationDate(status.expiresAt)}.`;
}

function formatSeasonStatusPeriod(seasonName: string) {
  return seasonName.trim().replace(/^сезон\s+/i, "");
}

export function getSeasonStatusDraft(rank: number, seasonName: string) {
  const seasonPeriod = formatSeasonStatusPeriod(seasonName);

  if (rank === 1) {
    return {
      type: ProfileStatusType.SEASON_CHAMPION,
      title: `Чемпион сезона ${seasonPeriod}`,
      description: "1 место в сезонном рейтинге.",
      tone: ProfileStatusTone.GOLD,
    };
  }

  if (rank === 2) {
    return {
      type: ProfileStatusType.SEASON_VICE_CHAMPION,
      title: `Вице-чемпион сезона ${seasonPeriod}`,
      description: "2 место в сезонном рейтинге.",
      tone: ProfileStatusTone.PURPLE,
    };
  }

  return {
    type: ProfileStatusType.SEASON_BRONZE,
    title: `Бронзовый призёр сезона ${seasonPeriod}`,
    description: "3 место в сезонном рейтинге.",
    tone: ProfileStatusTone.BLUE,
  };
}

export async function createSeasonStatusNominations(seasonId: string) {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    select: { id: true, name: true },
  });

  if (!season) return [];

  const ratings = await getPlayerRatings({ seasonId });
  const topPlayers = ratings.filter((player) => player.played > 0).slice(0, 3);

  return Promise.all(
    topPlayers.map((player, index) => {
      const rank = index + 1;
      const draft = getSeasonStatusDraft(rank, season.name);

      return db.userProfileStatus.upsert({
        where: {
          userId_seasonId_type: {
            userId: player.playerId,
            seasonId: season.id,
            type: draft.type,
          },
        },
        update: {
          title: draft.title,
          description: draft.description,
          tone: draft.tone,
          sourceRank: rank,
          approvalStatus: ProfileStatusApprovalStatus.PENDING,
          selectedOrder: null,
          approvedAt: null,
          expiresAt: null,
          expiredNotifiedAt: null,
          reviewedAt: null,
          reviewedById: null,
        },
        create: {
          userId: player.playerId,
          seasonId: season.id,
          type: draft.type,
          title: draft.title,
          description: draft.description,
          tone: draft.tone,
          sourceRank: rank,
        },
      });
    }),
  );
}

export async function approveProfileStatus(status: UserProfileStatus, adminId: string) {
  const now = new Date();
  const expiresAt = status.expiresAt ?? getManualProfileStatusExpiresAt(status.type, now);
  const approved = await db.userProfileStatus.update({
    where: { id: status.id },
    data: {
      approvalStatus: ProfileStatusApprovalStatus.APPROVED,
      approvedAt: now,
      expiresAt,
      expiredNotifiedAt: null,
      reviewedAt: now,
      reviewedById: adminId,
    },
  });

  await createNotification({
    userId: status.userId,
    title: "Новый статус профиля",
    body: buildProfileStatusGrantedBody(approved),
    type: NotificationType.SYSTEM,
    link: "/dashboard/edit",
  });

  return approved;
}

export async function grantManualProfileStatuses({
  userId,
  adminId,
  statusTypes,
  ambassadorYoutubeUrl,
  ambassadorYoutubeChannelTitle,
}: {
  userId: string;
  adminId: string;
  statusTypes: ProfileStatusType[];
  ambassadorYoutubeUrl?: string;
  ambassadorYoutubeChannelTitle?: string;
}) {
  const uniqueStatusTypes = Array.from(new Set(statusTypes));
  const drafts = manualProfileStatusDrafts.filter((draft) => uniqueStatusTypes.includes(draft.type));
  const now = new Date();

  const statuses = await Promise.all(
    drafts.map(async (draft) => {
      const expiresAt = getManualProfileStatusExpiresAt(draft.type, now);
      const ambassadorData =
        draft.type === ProfileStatusType.AMBASSADOR
          ? {
              youtubeUrl: ambassadorYoutubeUrl ?? null,
              youtubeChannelTitle: ambassadorYoutubeChannelTitle ?? null,
            }
          : {
              youtubeUrl: null,
              youtubeChannelTitle: null,
            };
      const existing = await db.userProfileStatus.findFirst({
        where: {
          userId,
          seasonId: null,
          type: draft.type,
        },
      });

      if (existing) {
        return db.userProfileStatus.update({
          where: { id: existing.id },
          data: {
            title: draft.title,
            description: draft.description,
            tone: draft.tone,
            approvalStatus: ProfileStatusApprovalStatus.APPROVED,
            approvedAt: now,
            expiresAt,
            expiredNotifiedAt: null,
            reviewedAt: now,
            reviewedById: adminId,
            ...ambassadorData,
          },
        });
      }

      return db.userProfileStatus.create({
        data: {
          userId,
          type: draft.type,
          title: draft.title,
          description: draft.description,
          tone: draft.tone,
          approvalStatus: ProfileStatusApprovalStatus.APPROVED,
          approvedAt: now,
          expiresAt,
          expiredNotifiedAt: null,
          reviewedAt: now,
          reviewedById: adminId,
          ...ambassadorData,
        },
      });
    }),
  );

  await Promise.all(
    statuses.map((status) =>
      createNotification({
        userId,
        title: "Новый статус профиля",
        body: buildProfileStatusGrantedBody(status),
        type: NotificationType.SYSTEM,
        link: "/dashboard/edit",
      }),
    ),
  );

  return statuses;
}

export async function grantCurrentChampionProfileStatus({
  userId,
  tournamentTitle,
  now = new Date(),
}: {
  userId: string;
  tournamentTitle?: string;
  now?: Date;
}) {
  const expiresAt = getCurrentChampionStatusExpiresAt(now);
  const description = tournamentTitle
    ? `Победитель турнира «${tournamentTitle}». Действует 30 дней с момента выдачи.`
    : currentChampionProfileStatusDraft.description;
  const existing = await db.userProfileStatus.findFirst({
    where: {
      userId,
      seasonId: null,
      type: currentChampionProfileStatusDraft.type,
    },
  });

  const status = existing
    ? await db.userProfileStatus.update({
        where: { id: existing.id },
        data: {
          title: currentChampionProfileStatusDraft.title,
          description,
          tone: currentChampionProfileStatusDraft.tone,
          approvalStatus: ProfileStatusApprovalStatus.APPROVED,
          approvedAt: now,
          expiresAt,
          expiredNotifiedAt: null,
          reviewedAt: null,
          reviewedById: null,
        },
      })
    : await db.userProfileStatus.create({
        data: {
          userId,
          type: currentChampionProfileStatusDraft.type,
          title: currentChampionProfileStatusDraft.title,
          description,
          tone: currentChampionProfileStatusDraft.tone,
          approvalStatus: ProfileStatusApprovalStatus.APPROVED,
          approvedAt: now,
          expiresAt,
          expiredNotifiedAt: null,
        },
      });

  await createNotification({
    userId,
    title: "Новый статус профиля",
    body: buildAutomaticProfileStatusGrantedBody(status),
    type: NotificationType.SYSTEM,
    link: "/dashboard/edit",
    dedupeWithinHours: 168,
  });

  return status;
}

export async function notifyExpiredProfileStatuses({
  userId,
  now = new Date(),
  take = 100,
}: {
  userId?: string;
  now?: Date;
  take?: number;
} = {}) {
  const expiredStatuses = await db.userProfileStatus.findMany({
    where: {
      ...(userId ? { userId } : {}),
      approvalStatus: ProfileStatusApprovalStatus.APPROVED,
      expiresAt: { lte: now },
      expiredNotifiedAt: null,
    },
    select: {
      id: true,
      userId: true,
      title: true,
    },
    orderBy: { expiresAt: "asc" },
    take,
  });

  await Promise.all(
    expiredStatuses.map(async (status) => {
      const updated = await db.userProfileStatus.updateMany({
        where: {
          id: status.id,
          expiredNotifiedAt: null,
        },
        data: {
          selectedOrder: null,
          expiredNotifiedAt: now,
        },
      });

      if (!updated.count) return null;

      return createNotification({
        userId: status.userId,
        title: "Срок статуса закончился",
        body: `Статус ${status.title} больше не активен и убран из профиля.`,
        type: NotificationType.SYSTEM,
        link: "/dashboard",
        dedupeKey: `profile-status-expired:${status.id}`,
      });
    }),
  );

  return { expiredCount: expiredStatuses.length };
}
