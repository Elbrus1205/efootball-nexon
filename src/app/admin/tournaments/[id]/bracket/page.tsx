import { ParticipantStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { BracketEditor } from "@/components/admin/bracket-editor";
import { PlayoffMappingEditor } from "@/components/admin/playoff-mapping-editor";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminTournamentAccessWhere } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentBracketPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.manageStructure");

  const tournament = await db.tournament.findFirst({
    where: { id: params.id, ...getAdminTournamentAccessWhere(session) },
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
  const advancingPerGroup =
    groupStage?.advancingPerGroup ??
    tournament.playoffTeamsPerGroup ??
    (groupStage?.groups.length && bracket ? Math.max(1, Math.min(Math.floor(bracket.size / groupStage.groups.length), 8)) : 2);

  const mappingSources =
    groupStage?.groups.flatMap((group, groupIndex) =>
      group.standings
        .filter((standing) => (standing.rank ?? 999) <= advancingPerGroup)
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
            Ручная расстановка участников по слотам плей-офф, настройка схемы выхода из групп и автозаполнение сетки по
            актуальным таблицам.
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
        <Card className="p-5 text-sm text-zinc-500">Сетка появится после генерации стадий и матчей для плей-офф.</Card>
      )}
    </div>
  );
}
