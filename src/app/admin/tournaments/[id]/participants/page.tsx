import { StageType } from "@prisma/client";
import { notFound } from "next/navigation";
import { ParticipantManager } from "@/components/admin/participant-manager";
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

  return <ParticipantManager tournamentId={tournament.id} participants={tournament.participants} groups={tournament.stages.flatMap((stage) => stage.groups)} />;
}
