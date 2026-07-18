import { CalendarDays, Clock3, Coins, Flag, Trophy, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type HeroFact = { label: string; value: string; icon: typeof CalendarDays };

export function TournamentHero({
  title,
  description,
  statusLabel,
  statusVariant,
  formatLabel,
  playoffLabel,
  startLabel,
  registrationDeadlineLabel,
  stageLabel,
  participantsLabel,
  prizePool,
  coverUrl,
  primaryAction,
  secondaryAction,
  tournamentId,
}: {
  title: string;
  description?: string | null;
  statusLabel: string;
  statusVariant: React.ComponentProps<typeof Badge>["variant"];
  formatLabel: string;
  playoffLabel?: string | null;
  startLabel: string;
  registrationDeadlineLabel: string;
  stageLabel: string;
  participantsLabel: string;
  prizePool?: string | null;
  coverUrl?: string | null;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  tournamentId: string;
}) {
  const facts: HeroFact[] = [
    { label: "Старт", value: startLabel, icon: CalendarDays },
    { label: "Этап", value: stageLabel, icon: Flag },
    { label: "Участники", value: participantsLabel, icon: Users },
    ...(prizePool ? [{ label: "Призовой фонд", value: prizePool, icon: Coins }] : []),
  ];

  return (
    <Card className="relative overflow-hidden rounded-3xl border-primary/20 bg-[#0c1115] p-0 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(33,241,168,0.12),transparent_32%)]" />
      <div className="relative grid lg:min-h-[420px] lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <div className="flex min-w-0 flex-col p-5 sm:p-7 lg:p-9 xl:p-11">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            <Badge variant="neutral">{formatLabel}</Badge>
            {playoffLabel ? <Badge variant="neutral">{playoffLabel}</Badge> : null}
          </div>
          <h1 className="mt-5 max-w-3xl break-words font-display text-3xl font-thin uppercase leading-[0.98] text-white sm:text-4xl lg:text-5xl xl:text-6xl">{title}</h1>
          {description ? <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">{description}</p> : null}

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500"><fact.icon className="h-3.5 w-3.5 text-primary" />{fact.label}</div>
                <div className="mt-1.5 break-words text-sm font-semibold text-white tabular-nums">{fact.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
            <div className="[&_button]:min-h-12 [&_button]:w-full [&_button]:bg-primary [&_button]:font-bold [&_button]:text-[#06110d] [&_button:hover]:bg-[#58f5bd] sm:[&_button]:w-auto">{primaryAction}</div>
            <Link href={`/tournaments/${tournamentId}?tab=rules`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-zinc-200 transition duration-200 hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none">
              <Trophy className="h-4 w-4" /> Правила
            </Link>
            {secondaryAction}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><Clock3 className="h-3.5 w-3.5" />Регистрация до {registrationDeadlineLabel}</div>
        </div>

        <div className="relative min-h-60 overflow-hidden border-t border-white/10 lg:min-h-full lg:border-l lg:border-t-0">
          {coverUrl ? (
            <Image src={coverUrl} alt={`Обложка турнира «${title}»`} fill unoptimized loading="lazy" sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_35%,rgba(33,241,168,0.3),transparent_20%),linear-gradient(135deg,#06110d_0%,#123428_48%,#080b0e_100%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,rgba(3,8,6,0.84)_100%)] lg:bg-[linear-gradient(90deg,rgba(12,17,21,0.35),transparent_35%),linear-gradient(180deg,transparent_35%,rgba(3,8,6,0.86)_100%)]" />
          <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3 sm:inset-x-7 sm:bottom-7">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">eFootball Nexon</div>
              <div className="mt-1 text-lg font-bold text-white">Путь к финалу начинается здесь</div>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-black/45 text-primary backdrop-blur"><Trophy className="h-5 w-5" /></span>
          </div>
        </div>
      </div>
    </Card>
  );
}
