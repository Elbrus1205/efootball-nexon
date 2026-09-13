import { AdminActionType, MatchStatus, ParticipantStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { invalidatePlayerRatings } from "@/lib/ratings-cache";
import { logAdminAction } from "@/lib/services/admin-actions";
import { recalculateGroupStandings } from "@/lib/services/tournaments";
import { invalidateTournamentAll } from "@/lib/tournament-cache";
import { getEffectiveParticipantRound } from "@/lib/tournaments/effective-participant-round";

const completedMatchStatuses = [MatchStatus.CONFIRMED, MatchStatus.FINISHED];

export class TournamentParticipantActivityError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "TournamentParticipantActivityError";
  }
}

type ActivityParams = {
  tournamentId: string;
  registrationId: string;
  active: boolean;
  actorId?: string | null;
};

const registrationSelect = {
  id: true,
  tournamentId: true,
  userId: true,
  status: true,
  isActive: true,
  inactiveFromRound: true,
  inactiveSince: true,
} as const;

function validateState(
  registration: { status: ParticipantStatus; isActive: boolean },
  active: boolean,
) {
  if (registration.status === ParticipantStatus.REMOVED) {
    throw new TournamentParticipantActivityError("Нельзя менять активность удалённого участника.", 400);
  }
  if (active && registration.isActive) {
    throw new TournamentParticipantActivityError("Участник уже активен.", 409);
  }
  if (!active && !registration.isActive) {
    throw new TournamentParticipantActivityError("Участник уже неактивен.", 409);
  }
}

export async function setTournamentParticipantActivity(params: ActivityParams) {
  const effectiveInactiveFromRound = params.active ? undefined : await getEffectiveParticipantRound(params.tournamentId);
  if (!params.active && (!Number.isInteger(effectiveInactiveFromRound) || effectiveInactiveFromRound! < 1)) {
    throw new TournamentParticipantActivityError("Не удалось определить тур, с которого участник станет неактивным.", 400);
  }

  const before = await db.tournamentRegistration.findFirst({
    where: { id: params.registrationId, tournamentId: params.tournamentId },
    select: registrationSelect,
  });
  if (!before) throw new TournamentParticipantActivityError("Участник турнира не найден.", 404);
  validateState(before, params.active);

  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-registration:${params.tournamentId}`}))`;

    const current = await tx.tournamentRegistration.findFirst({
      where: { id: params.registrationId, tournamentId: params.tournamentId },
      select: registrationSelect,
    });
    if (!current) throw new TournamentParticipantActivityError("Участник турнира не найден.", 404);
    validateState(current, params.active);

    const updated = await tx.tournamentRegistration.update({
      where: { id: params.registrationId },
      data: params.active
        ? { isActive: true, inactiveFromRound: null, inactiveSince: null }
        : {
            isActive: false,
            inactiveFromRound: effectiveInactiveFromRound!,
            inactiveSince: new Date(),
          },
      select: registrationSelect,
    });

    if (!params.active) {
      await tx.match.updateMany({
        where: {
          tournamentId: params.tournamentId,
          round: { gte: effectiveInactiveFromRound! },
          OR: [
            { participant1EntryId: params.registrationId },
            { participant2EntryId: params.registrationId },
          ],
          status: { in: completedMatchStatuses },
          player1Score: { not: null },
          player2Score: { not: null },
        },
        data: { excludeFromStatistics: true },
      });
    }

    return updated;
  });

  await recalculateGroupStandings(params.tournamentId);
  invalidatePlayerRatings();
  invalidateTournamentAll(params.tournamentId);

  if (params.actorId) {
    await logAdminAction({
      adminId: params.actorId,
      tournamentId: params.tournamentId,
      entityType: "TOURNAMENT_PARTICIPANT",
      entityId: params.registrationId,
      actionType: AdminActionType.UPDATE,
      beforeJson: before,
      afterJson: result,
    });
  }

  return result;
}
