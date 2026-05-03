import { NotificationType, ProfileStatusApprovalStatus, ProfileStatusTone, ProfileStatusType, type UserProfileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlayerRatings } from "@/lib/ratings";
import { createNotification } from "@/lib/services/notifications";
import { MAX_SELECTED_PROFILE_STATUSES } from "@/lib/profile-status-style";

export { MAX_SELECTED_PROFILE_STATUSES };

export function getSeasonStatusDraft(rank: number, seasonName: string) {
  if (rank === 1) {
    return {
      type: ProfileStatusType.SEASON_CHAMPION,
      title: `Чемпион сезона ${seasonName}`,
      description: "1 место в сезонном рейтинге.",
      tone: ProfileStatusTone.GOLD,
    };
  }

  if (rank === 2) {
    return {
      type: ProfileStatusType.SEASON_VICE_CHAMPION,
      title: `Вице-чемпион сезона ${seasonName}`,
      description: "2 место в сезонном рейтинге.",
      tone: ProfileStatusTone.PURPLE,
    };
  }

  return {
    type: ProfileStatusType.SEASON_BRONZE,
    title: `Бронзовый призёр сезона ${seasonName}`,
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
