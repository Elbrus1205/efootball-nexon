import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Trophy, Users } from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const statusMap: Record<TournamentStatus, { label: string; variant: "primary" | "accent" | "success" | "neutral" }> = {
  DRAFT: { label: "Черновик", variant: "neutral" },
  REGISTRATION_OPEN: { label: "Регистрация", variant: "primary" },
  REGISTRATION_CLOSED: { label: "Закрыт набор", variant: "accent" },
  AWAITING_START: { label: "Ожидает старта", variant: "accent" },
  IN_PROGRESS: { label: "Идёт турнир", variant: "success" },
  COMPLETED: { label: "Завершён", variant: "neutral" },
};

type TournamentCardTournament = {
  id: string;
  title: string;
  status: TournamentStatus;
  startsAt: Date;
  maxParticipants: number;
  prizePool: string | null;
  coverImage: string | null;
};

export function TournamentCard({
  tournament,
  participantsCount,
  priorityImage = false,
}: {
  tournament: TournamentCardTournament;
  participantsCount: number;
  priorityImage?: boolean;
}) {
  const status = statusMap[tournament.status];

  return (
    <Link href={`/tournaments/${tournament.id}`} className="group block h-full">
      <Card className="flex h-full flex-col justify-between overflow-hidden transition hover:-translate-y-1 hover:border-primary/30">
        {tournament.coverImage ? (
          <div className="-mx-5 -mt-5 mb-5 h-40 overflow-hidden border-b border-white/10 bg-white/[0.03]">
            <Image
              src={tournament.coverImage}
              alt={tournament.title}
              width={640}
              height={360}
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              priority={priorityImage}
              unoptimized
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <CardHeader>
          <div className="mb-3 flex items-center justify-between gap-3">
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <CardTitle>{tournament.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-zinc-300">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span>Старт: {formatDate(tournament.startsAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-primary" />
            <span>
              Участники: {participantsCount}/{tournament.maxParticipants}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Trophy className="h-4 w-4 text-accent" />
            <span>Призовой фонд: {tournament.prizePool || "Уточняется"}</span>
          </div>
          <span className="mt-1 inline-flex h-10 w-fit items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 text-xs font-bold uppercase tracking-[0.08em] text-primary transition group-hover:border-primary/55 group-hover:bg-primary/15 group-hover:text-amber-100">
            В турнир
            <ArrowRight className="h-4 w-4" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
