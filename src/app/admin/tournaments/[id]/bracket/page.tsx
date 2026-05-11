import { ParticipantStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { BracketEditor } from "@/components/admin/bracket-editor";
import { PlayoffMappingEditor } from "@/components/admin/playoff-mapping-editor";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentBracketPage({ params }: { params: { id: string } }) {
  await requirePermission("tournaments.manageStructure");

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        include: { user: true },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      stages: {
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
                    include: { user: true },
                  },
                },
                orderBy: { rank: "asc" },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
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
  const groupStage = tournament.stages.find((stage) => stage.type === "GROUP_STAGE");
  const groupAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const activeParticipants = tournament.participants.filter(
    (participant) => participant.status !== ParticipantStatus.REMOVED && participant.status !== ParticipantStatus.REJECTED,
  );

  const mappingSources =
    groupStage?.groups.flatMap((group, groupIndex) =>
      group.standings
        .filter((standing) => (standing.rank ?? 999) <= (groupStage.advancingPerGroup ?? 2))
        .map((standing) => ({
          groupId: group.id,
          groupName: group.name,
          rank: standing.rank ?? 999,
          label: `${groupAlphabet[groupIndex] ?? `G${groupIndex + 1}`}${standing.rank ?? "?"}`,
          participantName: standing.participant.user.name ?? null,
          sourceRef: `group:${group.id}:rank:${standing.rank ?? 999}`,
        })),
    ) ?? [];

  const firstRoundSlots =
    bracket?.matches
      .filter((match) => match.round === 1)
      .flatMap((match) =>
        [1, 2].map((slotNumber) => {
          const slot = bracket.slots.find(
            (item) => item.round === 1 && item.matchNumber === match.matchNumber && item.slotNumber === slotNumber,
          );

          return {
            round: 1,
            matchNumber: match.matchNumber,
            slotNumber,
            sourceRef: slot?.sourceRef ?? null,
          };
        }),
      ) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bracket Editor</CardTitle>
          <CardDescription>
            Р СѓС‡РЅР°СЏ СЂР°СЃСЃС‚Р°РЅРѕРІРєР° СѓС‡Р°СЃС‚РЅРёРєРѕРІ РїРѕ СЃР»РѕС‚Р°Рј РїР»РµР№-РѕС„С„, РЅР°СЃС‚СЂРѕР№РєР° СЃС…РµРјС‹ РІС‹С…РѕРґР° РёР· РіСЂСѓРїРї Рё Р°РІС‚РѕР·Р°РїРѕР»РЅРµРЅРёРµ СЃРµС‚РєРё РїРѕ
            Р°РєС‚СѓР°Р»СЊРЅС‹Рј С‚Р°Р±Р»РёС†Р°Рј.
          </CardDescription>
        </CardHeader>
      </Card>

      {bracket ? (
        <div className="space-y-6">
          {mappingSources.length ? (
            <PlayoffMappingEditor
              tournamentId={tournament.id}
              bracketId={bracket.id}
              sources={mappingSources}
              slots={firstRoundSlots}
            />
          ) : null}

          <BracketEditor
            tournamentId={tournament.id}
            bracketId={bracket.id}
            participants={activeParticipants}
            slots={bracket.slots}
            matches={bracket.matches}
          />
        </div>
      ) : (
        <Card className="p-5 text-sm text-zinc-500">РЎРµС‚РєР° РїРѕСЏРІРёС‚СЃСЏ РїРѕСЃР»Рµ РіРµРЅРµСЂР°С†РёРё СЃС‚Р°РґРёР№ Рё РјР°С‚С‡РµР№ РґР»СЏ РїР»РµР№-РѕС„С„.</Card>
      )}
    </div>
  );
}
