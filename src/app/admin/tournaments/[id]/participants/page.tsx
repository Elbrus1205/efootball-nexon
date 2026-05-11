import { StageType } from "@prisma/client";
import { notFound } from "next/navigation";
import { ParticipantManager } from "@/components/admin/participant-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentParticipantsPage({ params }: { params: { id: string } }) {
  await requirePermission("tournaments.manageParticipants");

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
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>РЈС‡Р°СЃС‚РЅРёРєРё, РїРѕСЃРµРІ Рё РіСЂСѓРїРїС‹</CardTitle>
          <CardDescription>РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ, СѓРґР°Р»РµРЅРёРµ, СЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ РїРѕ РіСЂСѓРїРїР°Рј Рё СЂСѓС‡РЅРѕР№ РєРѕРЅС‚СЂРѕР»СЊ СЃРѕСЃС‚Р°РІР° С‚СѓСЂРЅРёСЂР°.</CardDescription>
        </CardHeader>
      </Card>

      <ParticipantManager tournamentId={tournament.id} participants={tournament.participants} groups={tournament.stages.flatMap((stage) => stage.groups)} users={users} />
    </div>
  );
}
