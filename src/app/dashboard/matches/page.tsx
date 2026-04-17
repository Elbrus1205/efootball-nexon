import Link from "next/link";
import { MatchStatus, StageType } from "@prisma/client";
import { CalendarDays, ChevronRight, ShieldCheck, Trophy } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

const statusVariant: Partial<Record<MatchStatus, "primary" | "accent" | "neutral" | "success" | "danger">> = {
  PENDING: "neutral",
  READY: "primary",
  RESULT_SUBMITTED: "accent",
  CONFIRMED: "success",
  REJECTED: "danger",
  FORFEIT: "danger",
};

function matchRoundLabel(match: { round: number; stage?: { type: StageType } | null }) {
  const isTour = match.stage?.type === StageType.GROUP_STAGE || match.stage?.type === StageType.LEAGUE;
  return `${isTour ? "Тур" : "Раунд"} ${match.round}`;
}

export default async function DashboardMatchesPage() {
  const session = await requireAuth();

  const matches = await db.match.findMany({
    where: {
      OR: [{ player1Id: session.user.id }, { player2Id: session.user.id }],
    },
    include: {
      tournament: true,
      stage: true,
      player1: true,
      player2: true,
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="page-shell space-y-6">
      <div className="space-y-3">
        <Badge variant="primary">Мои матчи</Badge>
        <h1 className="font-display text-3xl font-thin text-white">Календарь и статус матчей игрока</h1>
        <p className="max-w-2xl text-zinc-400">Ближайшие встречи, результаты, стадия турнира и быстрый переход к загрузке подтверждения матча.</p>
      </div>

      <div className="grid gap-4">
        {matches.length ? (
          matches.map((match) => {
            const opponent = match.player1Id === session.user.id ? match.player2 : match.player1;

            return (
              <Card key={match.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-white">{match.tournament.title}</div>
                      <Badge variant={statusVariant[match.status] ?? "neutral"}>{match.status}</Badge>
                      {match.stage ? <Badge variant="neutral">{match.stage.name}</Badge> : null}
                    </div>
                    <div className="text-sm text-zinc-300">Соперник: {opponent?.nickname ?? opponent?.name ?? "Будет определён позже"}</div>
                    <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {match.scheduledAt ? formatDate(match.scheduledAt) : "Дата пока не назначена"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-accent" />
                        {matchRoundLabel(match)}, матч {match.matchNumber}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary">
                      <Link href={`/tournaments/${match.tournamentId}`}>
                        Открыть турнир
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link href={`/tournaments/${match.tournamentId}`}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Отправить результат
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-6 text-sm text-zinc-500">После регистрации в турнире здесь появятся ближайшие матчи, статусы и быстрые действия.</Card>
        )}
      </div>
    </div>
  );
}
