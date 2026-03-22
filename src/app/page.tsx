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
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <Badge variant="primary">eFootball Mobile • Турниры для игроков</Badge>

          <div className="space-y-4">
            <h1 className="max-w-4xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Турниры eFootball Mobile в одном месте.
            </h1>

            <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              Участники следят за матчами, подают результаты и проходят по сетке в удобном мобильном формате.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                Начать участие
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/tournaments">Смотреть турниры</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Trophy,
                title: "Турнирные сетки",
                description: "Single, double elimination и круговой формат для разных стадий сезона.",
              },
              {
                icon: Smartphone,
                title: "Mobile first",
                description: "Регистрация, матчи и результаты удобно открываются с телефона.",
              },
              {
                icon: ShieldCheck,
                title: "Проверка матчей",
                description: "Скриншоты и спорные результаты проходят модерацию перед подтверждением.",
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
              <div className="text-sm uppercase tracking-[0.2em] text-primary">Live Preview</div>
              <div className="mt-2 font-display text-2xl font-semibold">Ближайший матчдей</div>
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
          title="Открытые события"
          description="Актуальные турниры, в которых игроки уже сейчас могут зарегистрироваться и следить за сеткой."
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
