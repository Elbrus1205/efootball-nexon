import { PlayerProfileView } from "@/components/players/player-profile-view";
import { requireAuth } from "@/lib/auth/session";
import { getUserAchievementProgress, syncUserAchievements } from "@/lib/achievements";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { getPlayerCareerStats } from "@/lib/player-stats";
import { getActiveProfileStatusWhere } from "@/lib/profile-status-query";
import { notifyExpiredProfileStatuses } from "@/lib/profile-statuses";
import { getPlayerRatings } from "@/lib/ratings";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { season?: string };
}) {
  const session = await requireAuth();
  await syncUserAchievements(session.user.id);
  await notifyExpiredProfileStatuses({ userId: session.user.id });
  const [user, clubs, seasons] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      include: {
        accounts: {
          select: {
            provider: true,
            providerAccountId: true,
          },
        },
        profileStatuses: {
          where: getActiveProfileStatusWhere(),
          orderBy: [{ selectedOrder: "asc" }, { createdAt: "desc" }],
        },
      },
    }),
    getAvailableClubs(),
    db.season.findMany({
      orderBy: [{ isActive: "desc" }, { startsAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!user) return null;

  const selectedSeason = searchParams?.season ? seasons.find((season) => season.id === searchParams.season || season.slug === searchParams.season) ?? null : null;
  const activeSeason = seasons.find((season) => season.isActive) ?? null;
  const ratingSeasonId = selectedSeason?.id ?? activeSeason?.id ?? null;
  const [careerStats, achievements, ratings] = await Promise.all([
    getPlayerCareerStats(user.id, { seasonId: selectedSeason?.id ?? null }),
    getUserAchievementProgress(user.id),
    getPlayerRatings({ seasonId: ratingSeasonId }),
  ]);
  const rating = ratings.find((player) => player.playerId === user.id)?.rating ?? null;

  return (
    <PlayerProfileView
      user={user}
      clubs={clubs}
      seasons={seasons}
      selectedSeason={selectedSeason}
      rating={rating}
      careerStats={careerStats}
      achievements={achievements}
      basePath="/dashboard"
      badgeLabel="Личный кабинет игрока"
      editHref="/dashboard/edit"
    />
  );
}
