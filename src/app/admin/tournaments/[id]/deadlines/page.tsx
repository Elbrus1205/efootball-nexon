import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { notFound } from "next/navigation";
import { RoundDeadlineManager } from "@/components/admin/round-deadline-manager";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentDeadlinesPage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      matches: {
        select: {
          id: true,
          stageId: true,
          round: true,
        },
      },
      stages: {
        include: {
          deadlines: {
            orderBy: { round: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) notFound();

  const deadlineStages = tournament.stages
    .map((stage) => {
      const stageMatches = tournament.matches.filter((match) => match.stageId === stage.id);
      const roundsFromMatches = Array.from(new Set(stageMatches.map((match) => match.round))).sort((a, b) => a - b);
      const roundsCount = stage.roundsCount && stage.roundsCount > 0 ? stage.roundsCount : (roundsFromMatches.at(-1) ?? 0);

      return {
        id: stage.id,
        name: stage.name,
        type: stage.type,
        rounds: Array.from({ length: roundsCount }, (_, index) => {
          const round = index + 1;
          const deadline = stage.deadlines.find((item) => item.round === round);

          return {
            round,
            deadlineAt: deadline?.deadlineAt.toISOString() ?? null,
            matchesCount: stageMatches.filter((match) => match.round === round).length,
          };
        }),
      };
    })
    .filter((stage) => stage.rounds.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Дедлайны турнира
            </CardTitle>
            <CardDescription>{tournament.title}: сроки для туров групп/лиги и раундов плей-офф.</CardDescription>
          </CardHeader>
        </Card>

        <Button asChild variant="outline" className="w-full lg:w-auto">
          <Link href={`/admin/tournaments/${tournament.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к турниру
          </Link>
        </Button>
      </div>

      <RoundDeadlineManager tournamentId={tournament.id} stages={deadlineStages} />
    </div>
  );
}
