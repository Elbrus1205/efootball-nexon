import { notFound } from "next/navigation";
import { PlayerProfileView } from "@/components/players/player-profile-view";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { getUserAchievementProgress } from "@/lib/achievements";
import { getPlayerCareerStats } from "@/lib/player-stats";
import { getActiveProfileStatusWhere } from "@/lib/profile-status-query";
import { getPlayerRatings } from "@/lib/ratings";

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { season?: string };
}) {
  const [user, clubs, seasons] = await Promise.all([
    db.user.findFirst({
      where: {
        OR: [{ id: params.id }, { publicId: params.id }],
      },
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

  if (!user) notFound();

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
      basePath={`/players/${user.publicId}`}
    />
  );
}
