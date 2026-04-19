import { ParticipantStatus, StageType, UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { StandingsManager } from "@/components/admin/standings-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminTournamentStandingsPage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      stages: {
        where: { type: StageType.GROUP_STAGE },
        include: {
          groups: {
            include: {
              standings: {
                where: {
                  participant: {
                    status: { notIn: [ParticipantStatus.REMOVED, ParticipantStatus.REJECTED] },
                  },
                },
                include: {
                  participant: {
                    include: {
                      user: true,
                    },
                  },
                },
                orderBy: { rank: "asc" },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
  });

  if (!tournament) notFound();
  const groups = tournament.stages.flatMap((stage) => stage.groups);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Standings Manager</CardTitle>
          <CardDescription>Живые таблицы групп с ручной правкой мест, очков, разницы мячей и статистики.</CardDescription>
        </CardHeader>
      </Card>

      {groups.length ? (
        <StandingsManager groups={groups} />
      ) : (
        <Card className="p-5 text-sm text-zinc-500">Таблицы появятся после создания группового этапа.</Card>
      )}
    </div>
  );
}
