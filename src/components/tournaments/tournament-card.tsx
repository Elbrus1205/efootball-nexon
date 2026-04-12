import Link from "next/link";
import { CalendarDays, Trophy, Users } from "lucide-react";
import { Tournament, TournamentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const statusMap: Record<TournamentStatus, { label: string; variant: "primary" | "accent" | "success" | "neutral" }> = {
  DRAFT: { label: "Черновик", variant: "neutral" },
  REGISTRATION_OPEN: { label: "Регистрация", variant: "primary" },
  REGISTRATION_CLOSED: { label: "Закрыт набор", variant: "accent" },
  IN_PROGRESS: { label: "Идёт турнир", variant: "success" },
  COMPLETED: { label: "Завершён", variant: "neutral" },
};

export function TournamentCard({
  tournament,
  participantsCount,
}: {
  tournament: Tournament;
  participantsCount: number;
}) {
  const status = statusMap[tournament.status];

  return (
    <Link href={`/tournaments/${tournament.id}`} className="block h-full">
      <Card className="flex h-full flex-col justify-between overflow-hidden transition hover:-translate-y-1 hover:border-primary/30">
        {tournament.coverImage ? (
          <div className="-mx-5 -mt-5 mb-5 h-40 overflow-hidden border-b border-white/10 bg-white/[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tournament.coverImage} alt={tournament.title} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <CardHeader>
          <div className="mb-3 flex items-center justify-between gap-3">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge>{tournament.format.replaceAll("_", " ")}</Badge>
          </div>
          <CardTitle>{tournament.title}</CardTitle>
          <CardDescription>{tournament.description.slice(0, 140)}...</CardDescription>
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
        </CardContent>
      </Card>
    </Link>
  );
}
