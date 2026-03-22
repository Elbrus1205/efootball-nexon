import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { BracketEditor } from "@/components/admin/bracket-editor";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminTournamentBracketPage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        include: { user: true },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      brackets: {
        include: {
          slots: { orderBy: [{ round: "asc" }, { matchNumber: "asc" }, { slotNumber: "asc" }] },
          matches: { orderBy: [{ round: "asc" }, { matchNumber: "asc" }] },
        },
      },
    },
  });

  if (!tournament) notFound();
  const bracket = tournament.brackets[0];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bracket Editor</CardTitle>
          <CardDescription>Ручная расстановка участников по слотам плей-офф и автозаполнение из результатов групп.</CardDescription>
        </CardHeader>
      </Card>

      {bracket ? (
        <BracketEditor
          tournamentId={tournament.id}
          bracketId={bracket.id}
          participants={tournament.participants}
          slots={bracket.slots}
          matches={bracket.matches}
        />
      ) : (
        <Card className="p-5 text-sm text-zinc-500">Сетка появится после генерации стадий и матчей для плей-офф.</Card>
      )}
    </div>
  );
}
