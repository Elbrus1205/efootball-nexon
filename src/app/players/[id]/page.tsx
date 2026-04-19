import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerCareerStatsPanel } from "@/components/players/player-career-stats";
import { PlayerSocialLinks } from "@/components/players/player-social-links";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { getPlayerCareerStats } from "@/lib/player-stats";
import { getUserSocialLinks } from "@/lib/social-links";
import { cn, formatDate } from "@/lib/utils";

function statsPeriodClass(active: boolean) {
  return cn(
    "inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm font-semibold transition",
    active
      ? "border-primary/35 bg-primary/15 text-white shadow-[0_0_22px_rgba(59,130,246,0.14)]"
      : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-primary/25 hover:text-white",
  );
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { season?: string };
}) {
  const [user, seasons] = await Promise.all([
    db.user.findUnique({
      where: { id: params.id },
      include: {
        accounts: {
          select: {
            provider: true,
            providerAccountId: true,
          },
        },
      },
    }),
    db.season.findMany({
      orderBy: [{ isActive: "desc" }, { startsAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!user) notFound();

  const selectedSeason = searchParams?.season ? seasons.find((season) => season.id === searchParams.season || season.slug === searchParams.season) ?? null : null;
  const socialLinks = getUserSocialLinks(user);
  const careerStats = await getPlayerCareerStats(user.id, { seasonId: selectedSeason?.id ?? null });
  const periodLabel = selectedSeason ? `Сезон: ${selectedSeason.name}` : "За всё время";

  return (
    <div className="page-shell space-y-8">
      <Card className="p-6">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-thin text-white">{getPlayerDisplayName(user)}</h1>
          <div className="grid gap-3 text-sm text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
            <div>Имя: {user.name ?? "Не указано"}</div>
            <div>На платформе: {formatDate(user.createdAt, "d MMM yyyy")}</div>
            {socialLinks.length > 0 ? (
              <div className="sm:col-span-2 lg:col-span-1">
                <PlayerSocialLinks links={socialLinks} />
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="rounded-lg p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-semibold text-white">Период статистики</div>
            <div className="mt-1 text-sm text-zinc-500">По умолчанию показывается статистика за всё время.</div>
          </div>
          {selectedSeason ? (
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
              {selectedSeason.startsAt ? formatDate(selectedSeason.startsAt, "d MMM yyyy") : "Дата старта не указана"}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/players/${user.id}`} className={statsPeriodClass(!selectedSeason)}>
            За всё время
          </Link>
          {seasons.map((season) => (
            <Link key={season.id} href={`/players/${user.id}?season=${season.id}`} className={statsPeriodClass(selectedSeason?.id === season.id)}>
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
