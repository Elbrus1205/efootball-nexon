import Link from "next/link";
import { Archive, CalendarRange, Crown, Medal, Shield } from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { profileStatusClassName } from "@/lib/profile-status-style";
import { getPlayerRatings } from "@/lib/ratings";
import { proxyTelegramAssetUrl } from "@/lib/telegram-assets";
import { cn, formatDate } from "@/lib/utils";

function rankStyle(rank: number) {
  if (rank === 1) return "border-amber-300/40 bg-amber-300/15 text-amber-200";
  if (rank === 2) return "border-zinc-200/30 bg-zinc-200/10 text-zinc-100";
  if (rank === 3) return "border-orange-300/35 bg-orange-300/15 text-orange-200";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4" />;
  if (rank <= 3) return <Medal className="h-4 w-4" />;
  return <span className="text-xs font-semibold">{rank}</span>;
}

function shouldShowRatingChange(changedAt: Date | null) {
  if (!changedAt) return false;
  return Date.now() - changedAt.getTime() <= 5 * 60 * 1000;
}

function formatRating(value: number) {
  return value.toFixed(1);
}

function seasonChipClass(active: boolean) {
  return cn(
    "inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm font-semibold transition",
    active
      ? "border-primary/35 bg-primary/15 text-white shadow-[0_0_22px_rgba(59,130,246,0.14)]"
      : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-primary/25 hover:text-white",
  );
}

export default async function RatingsPage({
  searchParams,
}: {
  searchParams?: { season?: string };
}) {
  const [session, seasons] = await Promise.all([
    getCurrentSession(),
    db.season.findMany({
      orderBy: [{ isActive: "desc" }, { startsAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const activeSeason = seasons.find((season) => season.isActive) ?? null;
  const requestedSeason = searchParams?.season;
  const selectedSeason =
    requestedSeason && requestedSeason !== "all"
      ? seasons.find((season) => season.id === requestedSeason || season.slug === requestedSeason) ?? null
      : null;
  const showAllTime = requestedSeason === "all" || (!activeSeason && !selectedSeason);
  const ratingSeason = showAllTime ? null : selectedSeason ?? activeSeason;
  const archivedSeasons = seasons.filter((season) => !season.isActive);
  const ratings = await getPlayerRatings({ seasonId: ratingSeason?.id ?? null });
  const topRatings = ratings.slice(0, 10);
  const currentUserIndex = session?.user ? ratings.findIndex((player) => player.playerId === session.user.id) : -1;
  const currentUserBelowTop = currentUserIndex >= 10;
  const visibleRatings = currentUserBelowTop ? [...topRatings, ratings[currentUserIndex]] : topRatings;
  const seasonCaption = ratingSeason
    ? `${ratingSeason.isActive ? "Активный сезон" : "Архивный сезон"}: ${ratingSeason.name}`
    : "Рейтинг за всё время";

  return (
    <div className="page-shell space-y-8">
      <div className="text-sm font-semibold uppercase tracking-[0.28em] text-primary drop-shadow-[0_0_16px_rgba(59,130,246,0.65)]">Рейтинги</div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="font-semibold text-white">Таблица рейтинга</div>
            <div className="mt-1 text-sm text-zinc-500">{seasonCaption}</div>
          </div>
          <Badge variant={ratingSeason?.isActive ? "success" : ratingSeason ? "neutral" : "primary"}>
            {ratingSeason ? (ratingSeason.isActive ? "Текущий сезон" : "Архив") : "Всё время"}
          </Badge>
        </div>

        <div className="overflow-hidden">
          <div className="min-w-0">
            <div className="grid grid-cols-[52px_minmax(0,1fr)_112px] items-center border-b border-white/10 bg-black/20 text-xs uppercase tracking-[0.16em] text-zinc-500 sm:grid-cols-[72px_minmax(0,1fr)_120px] sm:tracking-[0.18em]">
              <div className="px-2 py-3 text-center sm:px-3">#</div>
              <div className="py-3 pl-0 pr-2">Игрок</div>
              <div className="py-3 pl-1 pr-2 text-right sm:pl-2 sm:pr-4 sm:text-center">Рейтинг</div>
            </div>

            <div className="divide-y divide-white/10">
              {visibleRatings.map((player, index) => {
                const rank = currentUserBelowTop && index === visibleRatings.length - 1 ? currentUserIndex + 1 : index + 1;
                const isCurrentUser = player.playerId === session?.user?.id;
                const showRatingChange = shouldShowRatingChange(player.lastRatingChangeAt) && player.lastRatingChange !== 0;
                const ratingChangeTone = player.lastRatingChange > 0 ? "text-emerald-300" : "text-rose-300";

                return (
                  <Fragment key={player.playerId}>
                    {currentUserBelowTop && index === visibleRatings.length - 1 ? (
                      <div key="current-user-separator" className="grid grid-cols-[52px_minmax(0,1fr)_112px] items-center text-sm text-zinc-500 sm:grid-cols-[72px_minmax(0,1fr)_120px]">
                        <div className="px-2 py-3 text-center sm:px-3">...</div>
                        <div className="py-3 pl-0 pr-2">...</div>
                        <div className="py-3 pl-1 pr-2 text-right sm:pl-2 sm:pr-4 sm:text-center">...</div>
                      </div>
                    ) : null}

                    <div
                      key={player.playerId}
                      className={`grid grid-cols-[52px_minmax(0,1fr)_112px] items-center text-sm transition hover:bg-white/[0.03] sm:grid-cols-[72px_minmax(0,1fr)_120px] ${
                        isCurrentUser ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="px-2 py-4 sm:px-3">
                        <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg border ${rankStyle(rank)}`}>
                          <RankIcon rank={rank} />
                        </div>
                      </div>
                      <div className="min-w-0 py-4 pl-0 pr-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20 sm:h-10 sm:w-10">
                            {player.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={proxyTelegramAssetUrl(player.image)} alt={player.playerName} className="h-full w-full object-cover" />
                            ) : (
                              <Shield className="h-4 w-4 text-zinc-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/players/${player.playerId}`} className="block truncate font-semibold text-white transition hover:text-primary">
                              {player.playerName}
                            </Link>
                            {player.selectedStatuses.length ? (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {player.selectedStatuses.map((status) => (
                                  <span key={status.id} className={profileStatusClassName(status.tone, "min-h-6 px-2 text-[10px]")}>
                                    {status.title}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 py-4 pl-1 pr-2 text-right sm:pl-2 sm:pr-4 sm:text-center">
                        <div className="inline-flex max-w-full items-center justify-end gap-1.5 rounded-full border border-white/5 bg-black/10 px-1.5 py-1 sm:justify-center sm:bg-transparent sm:px-0 sm:py-0">
                          <span className="text-lg font-black leading-none text-white">{formatRating(player.rating)}</span>
                          {showRatingChange ? (
                            <span className={`shrink-0 rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] font-black leading-none ring-1 ring-white/10 sm:text-[11px] ${ratingChangeTone}`}>
                              {player.lastRatingChange > 0 ? "+" : ""}
                              {formatRating(player.lastRatingChange)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold text-white">
              <Archive className="h-4 w-4 text-primary" />
              Архивные сезоны
            </div>
            <div className="mt-1 text-sm text-zinc-500">Выберите сезон, чтобы посмотреть рейтинг на тот период.</div>
          </div>
          {activeSeason ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
              <CalendarRange className="h-4 w-4" />
              Сейчас: {activeSeason.name}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/ratings?season=all" className={seasonChipClass(!ratingSeason)}>
            За всё время
          </Link>
          {activeSeason ? (
            <Link href="/ratings" className={seasonChipClass(ratingSeason?.id === activeSeason.id)}>
              {activeSeason.name}
            </Link>
          ) : null}
          {archivedSeasons.map((season) => (
            <Link key={season.id} href={`/ratings?season=${season.id}`} className={seasonChipClass(ratingSeason?.id === season.id)}>
              {season.name}
              {season.endsAt ? <span className="ml-2 text-xs text-current/60">{formatDate(season.endsAt, "d MMM yyyy")}</span> : null}
            </Link>
          ))}
        </div>

        {!seasons.length ? (
          <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
            Сезоны появятся здесь после запуска первого сезона в админ-панели.
          </div>
        ) : null}
      </Card>
    </div>
  );
}
