import { Prisma, UserRole } from "@prisma/client";
import { db } from "@/lib/db";

type AdminTournamentSession = {
  user: {
    id: string;
    role: UserRole;
  };
};

export const traineeTournamentAccessError = "Практикант может работать только со своими учебными турнирами.";

export function getAdminTournamentAccessWhere(session: AdminTournamentSession): Prisma.TournamentWhereInput {
  if (session.user.role !== UserRole.TRAINEE) return {};

  return {
    createdById: session.user.id,
    notificationsEnabled: false,
  };
}

export async function assertCanManageTournament(session: AdminTournamentSession, tournamentId: string) {
  if (session.user.role !== UserRole.TRAINEE) return;

  const tournament = await db.tournament.findFirst({
    where: {
      id: tournamentId,
      ...getAdminTournamentAccessWhere(session),
    },
    select: { id: true },
  });

  if (!tournament) {
    throw new Error(traineeTournamentAccessError);
  }
}

export async function assertCanManageMatch(session: AdminTournamentSession, matchId: string) {
  if (session.user.role !== UserRole.TRAINEE) return;

  const match = await db.match.findFirst({
    where: {
      id: matchId,
      tournament: getAdminTournamentAccessWhere(session),
    },
    select: { id: true },
  });

  if (!match) {
    throw new Error(traineeTournamentAccessError);
  }
}
