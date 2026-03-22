import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { StageEditor } from "@/components/admin/stage-editor";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminTournamentStagesPage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
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
          <CardDescription>Управление порядком, статусом и структурой этапов турнира: лига, группы и плей-офф.</CardDescription>
        </CardHeader>
      </Card>

      <StageEditor stages={tournament.stages} />
    </div>
  );
}
