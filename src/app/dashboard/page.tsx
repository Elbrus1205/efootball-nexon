import Link from "next/link";
import { PencilLine } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { getPlayerCareerStats } from "@/lib/player-stats";
import { getUserSocialLinks } from "@/lib/social-links";
import { PlayerCareerStatsPanel } from "@/components/players/player-career-stats";
import { PlayerSocialLinks } from "@/components/players/player-social-links";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";

function statsPeriodClass(active: boolean) {
  return cn(
    "inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm font-semibold transition",
    active
      ? "border-primary/35 bg-primary/15 text-white shadow-[0_0_22px_rgba(59,130,246,0.14)]"
      : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-primary/25 hover:text-white",
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { season?: string };
}) {
  const session = await requireAuth();
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
      },
    }),
    getAvailableClubs(),
    db.season.findMany({
      orderBy: [{ isActive: "desc" }, { startsAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!user) return null;

  const selectedSeason = searchParams?.season ? seasons.find((season) => season.id === searchParams.season || season.slug === searchParams.season) ?? null : null;
  const careerStats = await getPlayerCareerStats(user.id, { seasonId: selectedSeason?.id ?? null });
  const displayName = user.name || user.nickname || "Игрок eFootball Nexon";
  const favoriteClub = clubs.find((club) => club.slug === user.favoriteTeam || club.name === user.favoriteTeam) ?? null;
  const socialLinks = getUserSocialLinks(user);
  const periodLabel = selectedSeason ? `Сезон: ${selectedSeason.name}` : "За всё время";
  const registeredAt = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(user.createdAt);

  return (
    <div className="page-shell space-y-8">
      <div className="space-y-3">
        <Badge variant="primary">Личный кабинет игрока</Badge>
      </div>

      <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
        <div className="relative overflow-hidden border-b border-white/10">
          <div
            className="h-40 rounded-t-[inherit] bg-[linear-gradient(180deg,rgba(22,33,54,1),rgba(12,18,30,1))] sm:h-52"
            style={
              user.bannerImage
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(8,10,16,0.18), rgba(8,10,16,0.7)), url(${user.bannerImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20" />

          <div className="relative px-5 pb-6 sm:px-6">
            <div className="-mt-10 flex items-end justify-between gap-4 sm:-mt-12">
              <div className="flex min-w-0 items-end gap-4">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 rounded-[1.75rem] border-4 border-[#101827] shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:h-24 sm:w-24">
                    <AvatarImage src={user.image || undefined} alt="Аватар игрока" />
                    <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <Link
                    href="/dashboard/edit"
                    aria-label="Редактировать профиль"
                    className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#111827] text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] sm:hidden"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="min-w-0 pb-[12px] sm:pb-1">
                  <h1 className="truncate text-[18px] font-semibold leading-none text-white sm:text-3xl">{displayName}</h1>
                  {user.bio ? <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{user.bio}</p> : null}
                </div>
              </div>

              <Button asChild variant="secondary" className="hidden gap-2 sm:inline-flex">
                <Link href="/dashboard/edit">
                  <PencilLine className="h-4 w-4" />
                  Редактировать профиль
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
          <div className="border-b border-white/10 pb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Никнейм</div>
            <div className="mt-2 text-sm font-medium text-white">{displayName}</div>
          </div>

          <div className="border-b border-white/10 pb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Любимый клуб</div>
            <div className="mt-2 flex items-center gap-3">
              {favoriteClub ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={favoriteClub.imagePath}
                    alt={favoriteClub.name}
                    className="h-8 w-8 rounded-full border border-white/10 bg-black/20 p-1 object-contain"
                  />
                  <div className="text-sm font-medium text-white">{favoriteClub.name}</div>
                </>
              ) : (
                <div className="text-sm font-medium text-white">Не выбран</div>
              )}
            </div>
          </div>

          <div className="border-b border-white/10 pb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Дата регистрации</div>
            <div className="mt-2 text-sm font-medium text-white">{registeredAt}</div>
          </div>

          {socialLinks.length > 0 ? (
            <div className="border-b border-white/10 pb-3">
              <PlayerSocialLinks links={socialLinks} />
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-lg p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-semibold text-white">Период статистики</div>
            <div className="mt-1 text-sm text-zinc-500">В профиле можно переключаться между общей статистикой и отдельными сезонами.</div>
          </div>
          {selectedSeason ? (
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
              {selectedSeason.startsAt ? formatDate(selectedSeason.startsAt, "d MMM yyyy") : "Дата старта не указана"}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/dashboard" className={statsPeriodClass(!selectedSeason)}>
            За всё время
          </Link>
          {seasons.map((season) => (
            <Link key={season.id} href={`/dashboard?season=${season.id}`} className={statsPeriodClass(selectedSeason?.id === season.id)}>
              {season.name}
              {season.isActive ? <span className="ml-2 text-xs text-emerald-300">активный</span> : null}
            </Link>
          ))}
        </div>

        {!seasons.length ? (
          <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
            Отдельные сезоны появятся после запуска сезона в админ-панели.
          </div>
        ) : null}
      </Card>

      <PlayerCareerStatsPanel stats={careerStats} periodLabel={periodLabel} />
    </div>
  );
}
