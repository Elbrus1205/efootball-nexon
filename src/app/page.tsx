import Link from "next/link";
import { ArrowRight, ShieldCheck, Smartphone, Trophy, Users } from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { SectionHeader } from "@/components/shared/section-header";

export default async function HomePage() {
  const tournaments = await db.tournament.findMany({
    where: {
      status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.IN_PROGRESS] },
    },
    include: {
      _count: { select: { participants: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 3,
  });

  return (
    <div className="page-shell space-y-16 py-10 sm:py-16">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-6">
          <Badge variant="primary">Турниры eFootball Mobile • Формат для игроков</Badge>

          <div className="space-y-4">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Платформа для игроков eFootball Mobile, где проходят матчи, турнирные сетки и сезонные розыгрыши.
            </h1>

            <p className="max-w-2xl text-lg text-zinc-400">
              На площадке собраны регистрация участников, расписание матчей, подтверждение результатов и актуальные турнирные таблицы в удобном мобильном формате.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                Присоединиться к турнирам
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/tournaments">Открыть список турниров</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Trophy,
                title: "Турнирные сетки",
                description: "Single Elimination, Double Elimination и круговой формат для игроков разных уровней.",
              },
              {
                icon: Smartphone,
                title: "Удобно с телефона",
                description: "Регистрация, просмотр матчей и отправка результатов рассчитаны на мобильный сценарий.",
              },
              {
                icon: ShieldCheck,
                title: "Проверка результатов",
                description: "Скриншоты и спорные результаты проходят модерацию, чтобы турнир шёл честно и прозрачно.",
              },
            ].map((item) => (
              <div key={item.title} className="glass-panel rounded-3xl p-4">
                <item.icon className="mb-3 h-5 w-5 text-primary" />
                <div className="font-medium text-white">{item.title}</div>
                <div className="mt-1 text-sm text-zinc-400">{item.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-primary">Актуально сейчас</div>
              <div className="mt-2 font-display text-2xl font-semibold">Ближайшие события</div>
            </div>
            <Users className="h-6 w-6 text-accent" />
          </div>

          <div className="space-y-4">
            {tournaments.slice(0, 2).map((tournament) => (
              <div key={tournament.id} className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <div className="font-medium text-white">{tournament.title}</div>
                <div className="mt-2 text-sm text-zinc-400">{tournament.description.slice(0, 90)}...</div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-primary">{tournament._count.participants} игроков</span>
                  <span className="text-zinc-500">{new Date(tournament.startsAt).toLocaleDateString("ru-RU")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader
          eyebrow="Турниры"
          title="Ближайшие турниры"
          description="Открытые и активные соревнования, в которых игроки уже сейчас могут подать заявку на участие."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} participantsCount={tournament._count.participants} />
          ))}
        </div>
      </section>
    </div>
  );
}
