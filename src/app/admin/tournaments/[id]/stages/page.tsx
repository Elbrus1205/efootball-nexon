import { notFound } from "next/navigation";
import { StageEditor } from "@/components/admin/stage-editor";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminTournamentAccessWhere } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentStagesPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.manageStructure");

  const tournament = await db.tournament.findFirst({
    where: { id: params.id, ...getAdminTournamentAccessWhere(session) },
    include: {
      stages: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stage Editor</CardTitle>
          <CardDescription>Управление порядком, статусом и visual pipeline этапов турнира: лига, группы и плей-офф.</CardDescription>
        </CardHeader>
      </Card>

      <StageEditor tournamentId={tournament.id} stages={tournament.stages} />
    </div>
  );
}
