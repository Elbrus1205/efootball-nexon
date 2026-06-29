import { StageType } from "@prisma/client";
import { notFound } from "next/navigation";
import { ParticipantManager } from "@/components/admin/participant-manager";
import { getAdminTournamentAccessWhere } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentParticipantsPage({ params }: { params: { id: string } }) {
  const session = await requirePermission("tournaments.manageParticipants");

  const [tournament, participants, stages] = await Promise.all([
    db.tournament.findFirst({
      where: { id: params.id, ...getAdminTournamentAccessWhere(session) },
      select: { id: true, participantMode: true, rosterSize: true },
    }),
    db.tournamentRegistration.findMany({
      where: { tournamentId: params.id },
      select: {
        id: true,
        status: true,
        seed: true,
        clubSlug: true,
        clubName: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            publicId: true,
            telegramUsername: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        rosterMembers: {
          where: { status: { in: ["PENDING", "ACCEPTED"] } },
          select: {
            id: true,
            isCaptain: true,
            status: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                publicId: true,
                telegramUsername: true,
              },
            },
          },
          orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
        },
      },
      orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
    }),
    db.tournamentStage.findMany({
      where: { tournamentId: params.id, type: StageType.GROUP_STAGE },
      select: {
        groups: {
          select: {
            id: true,
            name: true,
          },
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { orderIndex: "asc" },
    }),
  ]);

  if (!tournament) notFound();

  return (
    <ParticipantManager
      tournamentId={tournament.id}
      participantMode={tournament.participantMode}
      rosterSize={tournament.rosterSize}
      participants={participants}
      groups={stages.flatMap((stage) => stage.groups)}
    />
  );
}
