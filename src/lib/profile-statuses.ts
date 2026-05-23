import { NotificationType, ProfileStatusApprovalStatus, ProfileStatusTone, ProfileStatusType, type UserProfileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlayerRatings } from "@/lib/ratings";
import { createNotification } from "@/lib/services/notifications";
import { MAX_SELECTED_PROFILE_STATUSES } from "@/lib/profile-status-style";

export { MAX_SELECTED_PROFILE_STATUSES };

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
] as const;

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
  const approved = await db.userProfileStatus.update({
    where: { id: status.id },
    data: {
      approvalStatus: ProfileStatusApprovalStatus.APPROVED,
      approvedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: adminId,
    },
  });

  await createNotification({
    userId: status.userId,
    title: "Новый статус профиля",
    body: `Администратор подтвердил статус: ${status.title}. Его можно выбрать в редакторе профиля.`,
    type: NotificationType.SYSTEM,
    link: "/dashboard/edit",
  });

  return approved;
}

export async function grantManualProfileStatuses({
  userId,
  adminId,
  statusTypes,
}: {
  userId: string;
  adminId: string;
  statusTypes: ProfileStatusType[];
}) {
  const uniqueStatusTypes = Array.from(new Set(statusTypes));
  const drafts = manualProfileStatusDrafts.filter((draft) => uniqueStatusTypes.includes(draft.type));
  const now = new Date();

  const statuses = await Promise.all(
    drafts.map(async (draft) => {
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
            reviewedAt: now,
            reviewedById: adminId,
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
          reviewedAt: now,
          reviewedById: adminId,
        },
      });
    }),
  );

  await Promise.all(
    statuses.map((status) =>
      createNotification({
        userId,
        title: "Новый статус профиля",
        body: `Администратор выдал вам статус: ${status.title}. Его можно выбрать в редакторе профиля.`,
        type: NotificationType.SYSTEM,
        link: "/dashboard/edit",
      }),
    ),
  );

  return statuses;
}
