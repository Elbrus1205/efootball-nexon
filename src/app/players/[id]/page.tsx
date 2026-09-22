import { notFound } from "next/navigation";
import { PlayerProfileView } from "@/components/players/player-profile-view";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { getUserAchievementProgress } from "@/lib/achievements";
import { getPlayerCareerStats } from "@/lib/player-stats";
import { getActiveProfileStatusWhere } from "@/lib/profile-status-query";
import { getPlayerRatings } from "@/lib/ratings";
import { getReliabilitySummary } from "@/lib/services/reliability";
import { getPlayerPodiumHistory, parsePodiumPage } from "@/lib/services/player-podium";
import { getPlayerHeadToHeadHistory } from "@/lib/services/player-head-to-head";
import { getCurrentSession } from "@/lib/auth/session";

export default async function PlayerProfilePage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ season?: string; historyPage?: string; matchesPage?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [user, clubs, seasons, session] = await Promise.all([
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
    getCurrentSession(),
  ]);

  if (!user) notFound();

  const selectedSeason = searchParams?.season ? seasons.find((season) => season.id === searchParams.season || season.slug === searchParams.season) ?? null : null;
  const activeSeason = seasons.find((season) => season.isActive) ?? null;
  const ratingSeasonId = selectedSeason?.id ?? activeSeason?.id ?? null;
  const headToHeadHistoryPromise = session?.user?.id && session.user.id !== user.id
    ? getPlayerHeadToHeadHistory(session.user.id, user.id, {
      page: Number(searchParams?.matchesPage ?? "1"),
      seasonId: selectedSeason?.id ?? null,
    })
    : Promise.resolve(null);
  const careerStatsPromise = getPlayerCareerStats(user.id, { seasonId: selectedSeason?.id ?? null });
  const [careerStats, achievements, ratings, reliability, podiumHistory, headToHeadHistory] = await Promise.all([
    careerStatsPromise,
    careerStatsPromise.then((stats) => getUserAchievementProgress(user.id, stats)),
    getPlayerRatings({ seasonId: ratingSeasonId }),
    getReliabilitySummary(user.id),
    getPlayerPodiumHistory(user.id, parsePodiumPage(searchParams?.historyPage)),
    headToHeadHistoryPromise,
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
      podiumHistory={podiumHistory}
      headToHeadHistory={headToHeadHistory}
      basePath={`/players/${user.publicId}`}
    />
  );
}
