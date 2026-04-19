import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ArrowLeft, Swords } from "lucide-react";
import { notFound } from "next/navigation";
import { MatchManager } from "@/components/admin/match-manager";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentMatchesPage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        include: { user: true, group: true },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      matches: {
        include: {
          player1: true,
          player2: true,
          stage: true,
          group: true,
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
    },
  });

  if (!tournament) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              Ручной редактор матчей
            </CardTitle>
            <CardDescription>{tournament.title}: live search, фильтры, drag-and-drop и ручная правка матчей.</CardDescription>
          </CardHeader>
        </Card>

        <Button asChild variant="outline" className="w-full lg:w-auto">
          <Link href={`/admin/tournaments/${tournament.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к турниру
          </Link>
        </Button>
      </div>

      <MatchManager
        tournamentId={tournament.id}
        matches={tournament.matches.map((match) => ({
          ...match,
          scheduledAt: match.scheduledAt?.toISOString() ?? null,
        }))}
        participants={tournament.participants}
      />
    </div>
  );
}
