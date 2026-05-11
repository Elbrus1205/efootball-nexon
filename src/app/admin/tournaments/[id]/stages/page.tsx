import { notFound } from "next/navigation";
import { StageEditor } from "@/components/admin/stage-editor";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentStagesPage({ params }: { params: { id: string } }) {
  await requirePermission("tournaments.manageStructure");

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
          <CardDescription>РЈРїСЂР°РІР»РµРЅРёРµ РїРѕСЂСЏРґРєРѕРј, СЃС‚Р°С‚СѓСЃРѕРј Рё visual pipeline СЌС‚Р°РїРѕРІ С‚СѓСЂРЅРёСЂР°: Р»РёРіР°, РіСЂСѓРїРїС‹ Рё РїР»РµР№-РѕС„С„.</CardDescription>
        </CardHeader>
      </Card>

      <StageEditor tournamentId={tournament.id} stages={tournament.stages} />
    </div>
  );
}
