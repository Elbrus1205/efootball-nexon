import { notFound } from "next/navigation";
import { TournamentApplicationManager } from "@/components/admin/tournament-application-manager";
import { getAdminTournamentAccessWhere } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";

export default async function AdminTournamentApplicationsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.manageParticipants");

  const tournament = await db.tournament.findFirst({
    where: { id: params.id, ...getAdminTournamentAccessWhere(session) },
    select: {
      id: true,
      requireLineupPhoto: true,
      registrationApplications: {
        select: {
          id: true,
          status: true,
          clubName: true,
          teamName: true,
          lineupPhotoUrl: true,
          rejectionReason: true,
          createdAt: true,
          reviewedAt: true,
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
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
      },
    },
  });

  if (!tournament) notFound();

  return (
    <TournamentApplicationManager
      tournamentId={tournament.id}
      enabled={tournament.requireLineupPhoto}
      applications={tournament.registrationApplications.map((application) => ({
        id: application.id,
        status: application.status,
        playerName: getPlayerDisplayName(application.user),
        publicId: application.user.publicId,
        email: application.user.email,
        telegramUsername: application.user.telegramUsername,
        clubName: application.clubName,
        teamName: application.teamName,
        lineupPhotoUrl: application.lineupPhotoUrl,
        rejectionReason: application.rejectionReason,
        createdAt: application.createdAt.toISOString(),
        reviewedAt: application.reviewedAt?.toISOString() ?? null,
      }))}
    />
  );
}
