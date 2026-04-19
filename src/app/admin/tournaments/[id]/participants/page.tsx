import { StageType, UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { ParticipantManager } from "@/components/admin/participant-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentParticipantsPage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        include: { user: true, group: true },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      stages: {
        where: { type: StageType.GROUP_STAGE },
        include: { groups: { orderBy: { orderIndex: "asc" } } },
      },
    },
  });

  if (!tournament) notFound();

  const users = await db.user.findMany({
    where: {
      isBanned: false,
      OR: [{ bannedUntil: null }, { bannedUntil: { lte: new Date() } }],
      id: { notIn: tournament.participants.map((item) => item.userId) },
    },
    orderBy: [{ nickname: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Участники, посев и группы</CardTitle>
          <CardDescription>Подтверждение, удаление, распределение по группам и ручной контроль состава турнира.</CardDescription>
        </CardHeader>
      </Card>

      <ParticipantManager tournamentId={tournament.id} participants={tournament.participants} groups={tournament.stages.flatMap((stage) => stage.groups)} users={users} />
    </div>
  );
}
