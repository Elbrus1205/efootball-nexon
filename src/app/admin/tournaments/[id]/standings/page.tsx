import { ParticipantStatus, StageType } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { StandingsManager } from "@/components/admin/standings-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminTournamentStandingsPage({ params }: { params: { id: string } }) {
  await requireAnyPermission(["tournaments.manageParticipants", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);

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
          <CardDescription>Р–РёРІС‹Рµ С‚Р°Р±Р»РёС†С‹ РіСЂСѓРїРї СЃ СЂСѓС‡РЅРѕР№ РїСЂР°РІРєРѕР№ РјРµСЃС‚, РѕС‡РєРѕРІ, СЂР°Р·РЅРёС†С‹ РјСЏС‡РµР№ Рё СЃС‚Р°С‚РёСЃС‚РёРєРё.</CardDescription>
        </CardHeader>
      </Card>

      {groups.length ? (
        <StandingsManager groups={groups} />
      ) : (
        <Card className="p-5 text-sm text-zinc-500">РўР°Р±Р»РёС†С‹ РїРѕСЏРІСЏС‚СЃСЏ РїРѕСЃР»Рµ СЃРѕР·РґР°РЅРёСЏ РіСЂСѓРїРїРѕРІРѕРіРѕ СЌС‚Р°РїР°.</Card>
      )}
    </div>
  );
}
