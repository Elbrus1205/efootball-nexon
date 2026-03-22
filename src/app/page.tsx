import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { SectionHeader } from "@/components/shared/section-header";

const heroPills = [
  "Турнирный сезон",
  "Премиальный интерфейс",
  "Mobile First",
];

const platformPoints = [
  {
    title: "Единый турнирный центр",
    description: "Регистрация, сетки, результаты и статусы матчей собраны в одном пространстве.",
  },
  {
    title: "Соревновательный ритм",
    description: "Каждый этап сезона выглядит структурно, читается быстро и ощущается как большой киберспорт.",
  },
  {
    title: "Комфорт с телефона",
    description: "Вся ключевая навигация, подача результатов и контроль турнира адаптированы под мобильный сценарий.",
  },
];

const features = [
  {
    icon: Trophy,
    title: "Турнирные сетки",
    description: "Single Elimination и Double Elimination в чистой визуальной подаче.",
  },
  {
    icon: Sparkles,
    title: "Онлайн-результаты",
    description: "Подтверждённые итоги матчей сразу формируют актуальную картину сезона.",
  },
  {
    icon: Smartphone,
    title: "Участие с телефона",
    description: "Регистрация, матчи и результаты доступны без тяжёлого десктопного сценария.",
  },
  {
    icon: ShieldCheck,
    title: "Прозрачная система",
    description: "Статусы, движение по сетке и история матчей остаются понятными на каждом этапе.",
  },
];

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

  const featuredTournament = tournaments[0];

  return (
    <div className="page-shell space-y-16 py-8 sm:space-y-20 sm:py-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#07111f] px-5 py-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_120px_rgba(7,15,35,0.8)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.24),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(109,93,251,0.22),transparent_20%),radial-gradient(circle_at_50%_100%,rgba(34,197,94,0.14),transparent_24%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute -left-12 top-14 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-10 right-8 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="space-y-7">
            <div className="flex flex-wrap gap-2">
              {heroPills.map((pill) => (
                <Badge key={pill} variant="primary" className="border-primary/20 bg-primary/10 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-blue-200">
                  {pill}
                </Badge>
              ))}
            </div>

            <div className="space-y-4">
              <div className="text-sm font-medium uppercase tracking-[0.34em] text-emerald-300/80">eFootball Mobile Platform</div>
              <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-7xl">
                eFootball Nexon
              </h1>
              <p className="max-w-3xl text-xl font-medium leading-8 text-blue-50/90 sm:text-2xl">
                Премиальная турнирная сцена для eFootball Mobile.
              </p>
              <p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                Сезонные розыгрыши, наглядные сетки, подтверждённые результаты и быстрый доступ ко всему турнирному циклу с телефона.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full bg-gradient-to-r from-primary via-blue-500 to-cyan-400 px-7 text-base text-white shadow-[0_0_30px_rgba(59,130,246,0.35)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(59,130,246,0.48)]">
                <Link href="/register">
                  Принять участие
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="h-12 rounded-full border border-white/10 bg-white/5 px-7 text-base text-white transition hover:border-white/20 hover:bg-white/10"
              >
                <Link href="/tournaments">Смотреть турниры</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { value: "24/7", label: "доступ к турнирам" },
                { value: "Live", label: "статусы матчей" },
                { value: "Mobile", label: "основной сценарий" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 backdrop-blur-xl transition hover:-translate-y-1 hover:border-primary/30">
                  <div className="text-lg font-semibold text-white">{item.value}</div>
                  <div className="mt-1 text-sm text-zinc-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5 backdrop-blur-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-primary">Live Preview</div>
                  <div className="mt-2 font-display text-2xl font-semibold text-white">Ближайший матчдей</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-emerald-400/20 text-accent shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                  <Swords className="h-5 w-5" />
                </div>
              </div>

              {featuredTournament ? (
                <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-[#0a0f18]/80 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-display text-2xl font-semibold text-white">{featuredTournament.title}</div>
                    <Badge variant="success" className="border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                      Активно
                    </Badge>
                  </div>

                  <p className="text-sm leading-6 text-zinc-400">
                    {featuredTournament.description.slice(0, 140)}
                    {featuredTournament.description.length > 140 ? "..." : ""}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="text-sm">Участники</span>
                      </div>
                      <div className="mt-2 text-xl font-semibold text-white">
                        {featuredTournament._count.participants}/{featuredTournament.maxParticipants}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <CalendarDays className="h-4 w-4 text-accent" />
                        <span className="text-sm">Старт</span>
                      </div>
                      <div className="mt-2 text-xl font-semibold text-white">
                        {new Date(featuredTournament.startsAt).toLocaleDateString("ru-RU")}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/tournaments/${featuredTournament.id}`}
                    className="group inline-flex items-center gap-2 text-sm font-medium text-blue-200 transition hover:text-white"
                  >
                    Открыть турнир
                    <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-zinc-400">
                  Новый турнирный сезон появится здесь сразу после публикации ближайшего события.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <SectionHeader
            eyebrow="О платформе"
            title="Турнирный продукт уровня киберспорта"
            description="eFootball Nexon объединяет всю соревновательную структуру eFootball Mobile в одном интерфейсе и делает её читаемой за несколько секунд."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {platformPoints.map((item) => (
            <div
              key={item.title}
              className="rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_20px_60px_rgba(59,130,246,0.12)]"
            >
              <div className="font-display text-xl font-semibold text-white">{item.title}</div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader
          eyebrow="Функции"
          title="Соревновательный цикл без лишнего шума"
          description="Ключевые инструменты турнира собраны в компактной, быстрой и визуально понятной системе."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((item) => (
            <div
              key={item.title}
              className="group rounded-[1.75rem] border border-white/10 bg-[#0d1320]/80 p-6 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_24px_60px_rgba(59,130,246,0.14)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-blue-500/20 to-emerald-400/10 text-primary shadow-[0_0_24px_rgba(59,130,246,0.16)] transition group-hover:scale-105 group-hover:shadow-[0_0_28px_rgba(59,130,246,0.28)]">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="mt-5 font-display text-xl font-semibold text-white">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader
          eyebrow="Турниры"
          title="Открытые события"
          description="Актуальные турниры, где уже открыт набор участников и формируется движение по сезону."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} participantsCount={tournament._count.participants} />
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-r from-primary/10 via-[#10192a] to-emerald-400/10 px-6 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.25)] sm:px-8">
        <div className="absolute -right-8 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-200">Season Entry</div>
            <h2 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">Новый сезон уже открыт</h2>
            <p className="mt-3 text-base leading-7 text-zinc-300">
              Платформа готова к регистрации участников, просмотру турнирной сетки и быстрому входу в актуальные события.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full bg-white px-7 text-base text-zinc-950 transition hover:bg-zinc-100">
              <Link href="/tournaments">Открыть турниры</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="h-12 rounded-full border border-white/15 bg-white/5 px-7 text-base text-white transition hover:bg-white/10"
            >
              <Link href="/dashboard">Личный кабинет</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
