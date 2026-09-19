import { unstable_cache } from "next/cache";
import { TournamentStatus } from "@prisma/client";
import { RatingsView } from "@/components/ratings/ratings-view";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parsePrizePoolValue } from "@/lib/home-stats";
import { getPlayerRatings } from "@/lib/ratings";

const ratingsDataLoads = new Map<string, Promise<unknown>>();
const ratingsDataValues = new Map<string, { expiresAt: number; value: unknown }>();

const getCachedRatingSeasons = unstable_cache(
  () => db.season.findMany({ orderBy: [{ isActive: "desc" }, { startsAt: "desc" }, { createdAt: "desc" }] }),
  ["public-rating-seasons"],
  { revalidate: 60, tags: ["player-ratings"] },
);

const getCachedRatingPrizeTournaments = unstable_cache(
  (seasonId: string | null) =>
    db.tournament.findMany({
      where: {
        isTest: false,
        status: TournamentStatus.COMPLETED,
        ...(seasonId ? { seasonId } : {}),
      },
      select: { prizePool: true },
    }),
  ["public-rating-prize-tournaments"],
  { revalidate: 60, tags: ["player-ratings"] },
);

function coalesceRatingLoad<T>(key: string, loader: () => Promise<T>) {
  const cached = ratingsDataValues.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value as T);
  if (cached) ratingsDataValues.delete(key);
  const existing = ratingsDataLoads.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = loader()
    .then((value) => {
      ratingsDataValues.set(key, { expiresAt: Date.now() + 60_000, value });
      return value;
    })
    .finally(() => ratingsDataLoads.delete(key));
  ratingsDataLoads.set(key, pending);
  return pending;
}

export default async function RatingsPage(
  props: {
    searchParams?: Promise<{ season?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const [session, seasons] = await Promise.all([
    getCurrentSession(),
    coalesceRatingLoad("seasons", getCachedRatingSeasons),
  ]);

  const activeSeason = seasons.find((season) => season.isActive) ?? null;
  const requestedSeason = searchParams?.season;
  const selectedSeason =
    requestedSeason && requestedSeason !== "all"
      ? seasons.find((season) => season.id === requestedSeason || season.slug === requestedSeason) ?? null
      : null;
  const showAllTime = requestedSeason === "all" || (!activeSeason && !selectedSeason);
  const ratingSeason = showAllTime ? null : selectedSeason ?? activeSeason;
  const [ratings, prizeTournaments] = await Promise.all([
    coalesceRatingLoad(`ratings:${ratingSeason?.id ?? "all"}`, () => getPlayerRatings({ seasonId: ratingSeason?.id ?? null })),
    coalesceRatingLoad(`prizes:${ratingSeason?.id ?? "all"}`, () => getCachedRatingPrizeTournaments(ratingSeason?.id ?? null)),
  ]);
  const ratingPrizePool = Math.floor(prizeTournaments.reduce((sum, tournament) => sum + parsePrizePoolValue(tournament.prizePool), 0) * 0.1);
  const currentUserIndex = session?.user ? ratings.findIndex((player) => player.playerId === session.user.id) : -1;

  return (
    <RatingsView
      players={ratings.slice(0, 10)}
      totalPlayers={ratings.length}
      currentPlayer={currentUserIndex >= 0 ? { player: ratings[currentUserIndex], rank: currentUserIndex + 1 } : null}
      seasons={seasons}
      ratingSeason={ratingSeason}
      prizePool={ratingPrizePool}
    />
  );
}
