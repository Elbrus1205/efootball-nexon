import { notFound } from "next/navigation";
import { PlayerProfileView } from "@/components/players/player-profile-view";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { getUserAchievementProgress } from "@/lib/achievements";
import { getPlayerCareerStats } from "@/lib/player-stats";
import { getActiveProfileStatusWhere } from "@/lib/profile-status-query";
import { getPlayerRatings } from "@/lib/ratings";
import { getReliabilitySummary } from "@/lib/services/reliability";

export default async function PlayerProfilePage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ season?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [user, clubs, seasons] = await Promise.all([
    db.user.findFirst({
      where: {
        OR: [{ id: params.id }, { publicId: params.id }],
      },
      select: {
        id: true,
        publicId: true,
        name: true,
        image: true,
        bannerImage: true,
        bio: true,
        favoriteTeam: true,
        timeZone: true,
        telegramId: true,
        telegramUsername: true,
        vkId: true,
        role: true,
        createdAt: true,
        accounts: {
          select: {
            provider: true,
            providerAccountId: true,
          },
        },
        profileStatuses: {
          where: getActiveProfileStatusWhere(),
          select: {
            id: true,
            title: true,
            tone: true,
            type: true,
            youtubeUrl: true,
            youtubeChannelTitle: true,
            selectedOrder: true,
          },
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
  const careerStatsPromise = getPlayerCareerStats(user.id, { seasonId: selectedSeason?.id ?? null });
  const [careerStats, achievements, ratings, reliability] = await Promise.all([
    careerStatsPromise,
    careerStatsPromise.then((stats) => getUserAchievementProgress(user.id, stats)),
    getPlayerRatings({ seasonId: ratingSeasonId }),
    getReliabilitySummary(user.id),
  ]);
  const ratingIndex = ratings.findIndex((player) => player.playerId === user.id);
  const rating = ratingIndex >= 0 ? ratings[ratingIndex].rating : null;
  const ratingPlace = ratingIndex >= 0 ? ratingIndex + 1 : null;

  return (
    <PlayerProfileView
      user={user}
      clubs={clubs}
      seasons={seasons}
      selectedSeason={selectedSeason}
      rating={rating}
      ratingPlace={ratingPlace}
      careerStats={careerStats}
      achievements={achievements}
      reliability={reliability}
      basePath={`/players/${user.publicId}`}
    />
  );
}
