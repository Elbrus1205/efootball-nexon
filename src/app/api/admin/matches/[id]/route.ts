import { MatchStatus, Prisma, ReliabilityPenaltyScope, TeamInviteStatus, type Match } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertCanManageMatch } from "@/lib/admin-tournament-access";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { ensureMatchLineupSnapshot, replaceMatchLineupSnapshotPlayer } from "@/lib/services/match-lineups";
import {
  applyConfiguredReliabilityPenalty,
  applyConfiguredReliabilityPenaltyToUsers,
  applyTechnicalLossPenalty,
  recordConfirmedMatchReliability,
  removeConfiguredReliabilityPenaltiesByPrefix,
} from "@/lib/services/reliability";
import { getMatchPenaltyTargetUserIds, uniqueReliabilityPenaltyUserIds } from "@/lib/services/reliability-penalty-targets";
import { notifyMatchReady, recalculateGroupStandings, resolveConfirmedMatch, syncTournamentLifecycleStatus } from "@/lib/services/tournaments";
import { invalidateTournamentSchedule } from "@/lib/tournament-cache";
import { matchUpdateSchema } from "@/lib/validators";
import { canEditMatchParticipants } from "@/lib/admin-match-participant-policy";
import {
  planCaptainTeamPlayerCorrection,
  resolveCaptainTeamPlayerChangeSide,
} from "@/lib/tournaments/captain-team-player-correction";
import { invalidatePlayerRatings } from "@/lib/ratings-cache";

function matchRequiresWinner(match: {
  bracketId: string | null;
  isPenaltyTiebreak: boolean;
  isCaptainAssignedTeamMatch: boolean;
  isTeamCaptainTiebreak: boolean;
  seriesWinsRequired: number | null;
}) {
  if (match.isCaptainAssignedTeamMatch && !match.isTeamCaptainTiebreak) return Boolean(match.bracketId);
  return Boolean(match.bracketId) || match.isPenaltyTiebreak || Boolean(match.seriesWinsRequired && match.seriesWinsRequired > 1);
}

function resolveWinner(params: {
  player1Id: string | null;
  player2Id: string | null;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
  player1Score: number | null;
  player2Score: number | null;
  player1PenaltyScore: number | null;
  player2PenaltyScore: number | null;
  requiresWinner: boolean;
  forcePenaltyWinner?: boolean;
}) {
  if (params.player1Score === null || params.player2Score === null) {
    return { winnerId: null, winnerEntryId: null };
  }

  if (params.forcePenaltyWinner) {
    if (
      params.player1PenaltyScore === null ||
      params.player2PenaltyScore === null ||
      params.player1PenaltyScore === params.player2PenaltyScore
    ) {
      throw new Error("PENALTY_REQUIRED");
    }

    return params.player1PenaltyScore > params.player2PenaltyScore
      ? { winnerId: params.player1Id, winnerEntryId: params.participant1EntryId }
      : { winnerId: params.player2Id, winnerEntryId: params.participant2EntryId };
  }

  if (params.player1Score > params.player2Score) {
    return { winnerId: params.player1Id, winnerEntryId: params.participant1EntryId };
  }

  if (params.player2Score > params.player1Score) {
    return { winnerId: params.player2Id, winnerEntryId: params.participant2EntryId };
  }

  if (!params.requiresWinner) {
    return { winnerId: null, winnerEntryId: null };
  }

  if (
    params.player1PenaltyScore === null ||
    params.player2PenaltyScore === null ||
    params.player1PenaltyScore === params.player2PenaltyScore
  ) {
    throw new Error("PENALTY_REQUIRED");
  }

  return params.player1PenaltyScore > params.player2PenaltyScore
    ? { winnerId: params.player1Id, winnerEntryId: params.participant1EntryId }
    : { winnerId: params.player2Id, winnerEntryId: params.participant2EntryId };
}

function isMultiLegPlayoffCandidate(match: Match) {
  return Boolean(
    match.bracketId &&
      match.seriesKey &&
      !match.isPenaltyTiebreak &&
      !match.isCaptainAssignedTeamMatch &&
      !(match.seriesWinsRequired && match.seriesWinsRequired > 1),
  );
}

function getForfeitLoserId(match: Pick<Match, "player1Id" | "player2Id" | "winnerId" | "player1Score" | "player2Score">) {
  if (match.winnerId && match.player1Id === match.winnerId) return match.player2Id;
  if (match.winnerId && match.player2Id === match.winnerId) return match.player1Id;
  if (match.player1Score !== null && match.player2Score !== null && match.player1Score > match.player2Score) return match.player2Id;
  if (match.player1Score !== null && match.player2Score !== null && match.player2Score > match.player1Score) return match.player1Id;
  return null;
}

const matchConfiguredPenaltyScopes = [ReliabilityPenaltyScope.SCORE_SUBMISSION];

async function removeMatchConfiguredReliabilityPenalties(matchId: string) {
  await removeConfiguredReliabilityPenaltiesByPrefix(`match-configured-penalty:${matchId}:`);
  await removeConfiguredReliabilityPenaltiesByPrefix(`match-score-penalty:${matchId}:`);
  await removeConfiguredReliabilityPenaltiesByPrefix(`match-forfeit-config:${matchId}:`);
}

async function applyMatchConfiguredReliabilityPenalty({
  reasonId,
  selectedUserIds,
  actorId,
  matchId,
  tournamentId,
  status,
  player1Score,
  player2Score,
}: {
  reasonId: string;
  selectedUserIds: string[];
  actorId: string;
  matchId: string;
  tournamentId: string;
  status: MatchStatus;
  player1Score: number | null;
  player2Score: number | null;
}) {
  const reason = await db.reliabilityPenaltyReason.findFirst({
    where: {
      id: reasonId,
      scope: { in: matchConfiguredPenaltyScopes },
      isActive: true,
    },
    select: { scope: true },
  });

  if (!reason) {
    throw new Error("RELIABILITY_PENALTY_REASON_NOT_FOUND");
  }

  const penaltyUserIds = await getMatchPenaltyTargetUserIds(matchId, selectedUserIds);
  const selectionSuffix = selectedUserIds.length > 1 ? ":both" : "";

  await applyConfiguredReliabilityPenaltyToUsers({
    reasonId,
    scope: reason.scope,
    userIds: penaltyUserIds,
    actorId,
    matchId,
    tournamentId,
    dedupeKeyForUserId: (targetUserId) => `match-configured-penalty:${matchId}:${targetUserId}:${reasonId}${selectionSuffix}`,
    comment:
      status === MatchStatus.FORFEIT
        ? "Штраф выбран администратором при выставлении технического поражения."
        : `Штраф выбран администратором при ручном подтверждении счета ${player1Score ?? 0}:${player2Score ?? 0}.`,
  });
}

function sortSeriesMatches(a: Match, b: Match) {
  return (
    (a.legNumber ?? 1) - (b.legNumber ?? 1) ||
    a.matchNumber - b.matchNumber ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

async function getMultiLegPenaltyDecision(match: Match, nextPlayer1Score: number | null, nextPlayer2Score: number | null) {
  if (!isMultiLegPlayoffCandidate(match) || !match.seriesKey) {
    return null;
  }

  const seriesMatches = (
    await db.match.findMany({
      where: { seriesKey: match.seriesKey, isPenaltyTiebreak: false },
    })
  ).sort(sortSeriesMatches);

  if (seriesMatches.length <= 1) {
    return null;
  }

  const lastMatch = seriesMatches[seriesMatches.length - 1];
  const matchesWithNextScore = seriesMatches.map((item) =>
    item.id === match.id ? { ...item, player1Score: nextPlayer1Score, player2Score: nextPlayer2Score } : item,
  );
  const allScoresKnown = matchesWithNextScore.every((item) => item.player1Score !== null && item.player2Score !== null);
  const aggregatePlayer1 = matchesWithNextScore.reduce((sum, item) => sum + (item.player1Score ?? 0), 0);
  const aggregatePlayer2 = matchesWithNextScore.reduce((sum, item) => sum + (item.player2Score ?? 0), 0);

  return {
    isLastMatch: lastMatch?.id === match.id,
    aggregateTied: allScoresKnown && aggregatePlayer1 === aggregatePlayer2,
  };
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAnyPermission(["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);
  await assertCanManageMatch(session, params.id);
  const body = matchUpdateSchema.parse(await request.json());

  const before = await db.match.findUnique({
    where: { id: params.id },
  });

  if (!before) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const participantFieldsChanged =
    "player1Id" in body ||
    "player2Id" in body ||
    "participant1EntryId" in body ||
    "participant2EntryId" in body;
  if (participantFieldsChanged && !canEditMatchParticipants(before, body)) {
    return NextResponse.json(
      { error: "Нельзя менять игроков или команды в матче с подтверждённым результатом." },
      { status: 409 },
    );
  }

  const data: Prisma.MatchUpdateInput = {};
  if ("player1Id" in body) data.player1 = body.player1Id ? { connect: { id: body.player1Id } } : { disconnect: true };
  if ("player2Id" in body) data.player2 = body.player2Id ? { connect: { id: body.player2Id } } : { disconnect: true };
  if ("participant1EntryId" in body) data.participant1Entry = body.participant1EntryId ? { connect: { id: body.participant1EntryId } } : { disconnect: true };
  if ("participant2EntryId" in body) data.participant2Entry = body.participant2EntryId ? { connect: { id: body.participant2EntryId } } : { disconnect: true };
  if ("scheduledAt" in body) data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if ("player1Score" in body) data.player1Score = body.player1Score;
  if ("player2Score" in body) data.player2Score = body.player2Score;
  if ("player1PenaltyScore" in body) data.player1PenaltyScore = body.player1PenaltyScore;
  if ("player2PenaltyScore" in body) data.player2PenaltyScore = body.player2PenaltyScore;
  if ("status" in body && body.status) data.status = body.status as MatchStatus;
  if ("notes" in body) data.notes = body.notes || null;

  const nextPlayer1Id = "player1Id" in body ? body.player1Id || null : before.player1Id;
  const nextPlayer2Id = "player2Id" in body ? body.player2Id || null : before.player2Id;
  const nextParticipant1EntryId = "participant1EntryId" in body ? body.participant1EntryId || null : before.participant1EntryId;
  const nextParticipant2EntryId = "participant2EntryId" in body ? body.participant2EntryId || null : before.participant2EntryId;
  const nextPlayer1Score = "player1Score" in body ? body.player1Score ?? null : before.player1Score;
  const nextPlayer2Score = "player2Score" in body ? body.player2Score ?? null : before.player2Score;
  const nextPlayer1PenaltyScore = "player1PenaltyScore" in body ? body.player1PenaltyScore ?? null : before.player1PenaltyScore;
  const nextPlayer2PenaltyScore = "player2PenaltyScore" in body ? body.player2PenaltyScore ?? null : before.player2PenaltyScore;
  const nextStatus = "status" in body && body.status ? (body.status as MatchStatus) : before.status;
  const selectedPenaltyUserIds = uniqueReliabilityPenaltyUserIds(
    "reliabilityPenaltyUserIds" in body
      ? body.reliabilityPenaltyUserIds ?? []
      : body.reliabilityPenaltyUserId
        ? [body.reliabilityPenaltyUserId]
        : [],
  );
  const statusExplicitlyChanged = "status" in body && Boolean(body.status);
  const multiLegPenaltyDecision = await getMultiLegPenaltyDecision(before, nextPlayer1Score, nextPlayer2Score);

  if (body.reliabilityPenaltyReasonId) {
    if (!selectedPenaltyUserIds.length || selectedPenaltyUserIds.some((userId) => ![nextPlayer1Id, nextPlayer2Id].includes(userId))) {
      return NextResponse.json({ error: "Выберите одного игрока или обоих игроков для штрафа надежности." }, { status: 400 });
    }
  }

  if (nextStatus === MatchStatus.CONFIRMED || nextStatus === MatchStatus.FINISHED) {
    try {
      const scoreTied = nextPlayer1Score !== null && nextPlayer2Score !== null && nextPlayer1Score === nextPlayer2Score;
      const scoreEditNeedsPenalty = multiLegPenaltyDecision
        ? Boolean(multiLegPenaltyDecision.isLastMatch && multiLegPenaltyDecision.aggregateTied)
        : matchRequiresWinner(before) && scoreTied;
      const forcePenaltyWinner = statusExplicitlyChanged && Boolean(multiLegPenaltyDecision?.isLastMatch && multiLegPenaltyDecision.aggregateTied);
      const requiresWinner = statusExplicitlyChanged ? (multiLegPenaltyDecision ? forcePenaltyWinner : matchRequiresWinner(before)) : false;
      const winner = resolveWinner({
        player1Id: nextPlayer1Id,
        player2Id: nextPlayer2Id,
        participant1EntryId: nextParticipant1EntryId,
        participant2EntryId: nextParticipant2EntryId,
        player1Score: nextPlayer1Score,
        player2Score: nextPlayer2Score,
        player1PenaltyScore: nextPlayer1PenaltyScore,
        player2PenaltyScore: nextPlayer2PenaltyScore,
        requiresWinner,
        forcePenaltyWinner,
      });

      data.winner = winner.winnerId ? { connect: { id: winner.winnerId } } : { disconnect: true };
      data.winningEntry = winner.winnerEntryId ? { connect: { id: winner.winnerEntryId } } : { disconnect: true };
      if (!statusExplicitlyChanged && scoreEditNeedsPenalty) {
        data.status = before.scheduledAt ? MatchStatus.SCHEDULED : MatchStatus.READY;
      }
    } catch (error) {
      if (error instanceof Error && error.message === "PENALTY_REQUIRED") {
        return NextResponse.json({ error: "Для ничьей в этом матче нужно указать пенальти с победителем." }, { status: 400 });
      }
      throw error;
    }
  }

  const correctedMatches: Match[] = [];
  const requestedPlayerChangeSide = before.isCaptainAssignedTeamMatch
    ? resolveCaptainTeamPlayerChangeSide({
        currentPlayer1Id: before.player1Id,
        currentPlayer2Id: before.player2Id,
        nextPlayer1Id,
        nextPlayer2Id,
        player1Provided: "player1Id" in body,
        player2Provided: "player2Id" in body,
      })
    : null;
  if (requestedPlayerChangeSide === "MULTIPLE") {
    return NextResponse.json(
      { error: "Меняйте игроков командного матча по одному, чтобы система корректно переставила их между парами." },
      { status: 400 },
    );
  }
  const requestedPlayerSide = requestedPlayerChangeSide;
  const requestedPlayerId = requestedPlayerSide === 1 ? nextPlayer1Id : requestedPlayerSide === 2 ? nextPlayer2Id : null;

  if (requestedPlayerSide && requestedPlayerId) {
    const registrationId = requestedPlayerSide === 1 ? before.participant1EntryId : before.participant2EntryId;
    const rosterMember = registrationId
      ? await db.tournamentRegistrationMember.findFirst({
          where: {
            registrationId,
            userId: requestedPlayerId,
            status: TeamInviteStatus.ACCEPTED,
          },
          select: { id: true },
        })
      : null;
    if (!rosterMember) {
      return NextResponse.json({ error: "Выберите игрока из актуального состава этой команды." }, { status: 400 });
    }
  }

  let updated: Match;
  if (requestedPlayerSide && requestedPlayerId) {
    updated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`captain-team-assignment:${before.tournamentId}`}))`;

      const siblings = await tx.match.findMany({
        where: {
          id: { not: before.id },
          tournamentId: before.tournamentId,
          stageId: before.stageId,
          groupId: before.groupId,
          bracketId: before.bracketId,
          round: before.round,
          matchNumber: before.matchNumber,
          legNumber: before.legNumber,
          seriesKey: before.seriesKey,
          participant1EntryId: before.participant1EntryId,
          participant2EntryId: before.participant2EntryId,
          isCaptainAssignedTeamMatch: true,
          isTeamCaptainTiebreak: false,
        },
      });
      const corrections = planCaptainTeamPlayerCorrection({
        target: before,
        siblings,
        side: requestedPlayerSide,
        nextPlayerId: requestedPlayerId,
      });

      for (const correction of corrections.slice(1)) {
        const sibling = siblings.find((match) => match.id === correction.matchId);
        if (!sibling) continue;

        const siblingData: Prisma.MatchUpdateInput = requestedPlayerSide === 1
          ? { player1: { connect: { id: correction.nextPlayerId } } }
          : { player2: { connect: { id: correction.nextPlayerId } } };
        if (sibling.winnerId === correction.previousPlayerId) {
          siblingData.winner = { connect: { id: correction.nextPlayerId } };
        }

        const correctedSibling = await tx.match.update({ where: { id: sibling.id }, data: siblingData });
        await replaceMatchLineupSnapshotPlayer({
          client: tx,
          matchId: sibling.id,
          side: requestedPlayerSide,
          previousUserId: correction.previousPlayerId,
          nextUserId: correction.nextPlayerId,
          registrationId: requestedPlayerSide === 1 ? sibling.participant1EntryId : sibling.participant2EntryId,
        });
        correctedMatches.push(correctedSibling);
      }

      const correctedTarget = await tx.match.update({ where: { id: params.id }, data });
      const targetCorrection = corrections[0];
      if (targetCorrection) {
        await replaceMatchLineupSnapshotPlayer({
          client: tx,
          matchId: correctedTarget.id,
          side: requestedPlayerSide,
          previousUserId: targetCorrection.previousPlayerId,
          nextUserId: targetCorrection.nextPlayerId,
          registrationId: requestedPlayerSide === 1 ? correctedTarget.participant1EntryId : correctedTarget.participant2EntryId,
        });
      }
      return correctedTarget;
    });
  } else {
    updated = await db.match.update({
      where: { id: params.id },
      data,
    });
  }

  // The match row (a schedule-slice field) always changed here; structure/rules
  // get busted below via recalculateGroupStandings / resolveConfirmedMatch when relevant.
  invalidateTournamentSchedule(updated.tournamentId);

  const isGroupMatch = Boolean(before.groupId || updated.groupId);
  const standingsRelevantChange =
    isGroupMatch &&
    (before.status !== updated.status ||
      before.player1Score !== updated.player1Score ||
      before.player2Score !== updated.player2Score ||
      before.player1PenaltyScore !== updated.player1PenaltyScore ||
      before.player2PenaltyScore !== updated.player2PenaltyScore ||
      before.winnerId !== updated.winnerId ||
      before.participant1EntryId !== updated.participant1EntryId ||
      before.participant2EntryId !== updated.participant2EntryId);

  if (standingsRelevantChange) {
    await recalculateGroupStandings(before.tournamentId);
  }

  const opponentsChanged =
    before.player1Id !== updated.player1Id ||
    before.player2Id !== updated.player2Id ||
    before.participant1EntryId !== updated.participant1EntryId ||
    before.participant2EntryId !== updated.participant2EntryId;
  if (opponentsChanged && updated.player1Id && updated.player2Id && updated.status !== MatchStatus.CANCELLED) {
    await notifyMatchReady(updated.id);
  }
  await Promise.all(
    correctedMatches
      .filter((match) => match.player1Id && match.player2Id && match.status !== MatchStatus.CANCELLED)
      .map((match) => notifyMatchReady(match.id)),
  );
  if (correctedMatches.length) invalidatePlayerRatings();

  const canHaveConfiguredPenalty =
    updated.status === MatchStatus.CONFIRMED || updated.status === MatchStatus.FINISHED || updated.status === MatchStatus.FORFEIT;

  if (statusExplicitlyChanged && !canHaveConfiguredPenalty) {
    await removeMatchConfiguredReliabilityPenalties(updated.id);
  }

  if (
    canHaveConfiguredPenalty &&
    ("reliabilityPenaltyReasonId" in body || "reliabilityPenaltyUserId" in body || "reliabilityPenaltyUserIds" in body)
  ) {
    await removeMatchConfiguredReliabilityPenalties(updated.id);

    if (body.reliabilityPenaltyReasonId && selectedPenaltyUserIds.length) {
      try {
        await applyMatchConfiguredReliabilityPenalty({
          reasonId: body.reliabilityPenaltyReasonId,
          selectedUserIds: selectedPenaltyUserIds,
          actorId: session.user.id,
          matchId: updated.id,
          tournamentId: updated.tournamentId,
          status: updated.status,
          player1Score: updated.player1Score,
          player2Score: updated.player2Score,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "RELIABILITY_PENALTY_REASON_NOT_FOUND") {
          return NextResponse.json({ error: "Выбранный штраф надежности больше недоступен." }, { status: 400 });
        }
        throw error;
      }
    }
  }

  if (updated.status === MatchStatus.CONFIRMED || updated.status === MatchStatus.FINISHED) {
    await ensureMatchLineupSnapshot(updated.id);
    await resolveConfirmedMatch(updated.id);
    await recordConfirmedMatchReliability({
      userIds: [updated.player1Id, updated.player2Id],
      matchId: updated.id,
      tournamentId: updated.tournamentId,
    });
    if (!("reliabilityPenaltyReasonId" in body) && body.reliabilityPenaltyReasonId && body.reliabilityPenaltyUserId) {
      try {
        await applyConfiguredReliabilityPenalty({
          reasonId: body.reliabilityPenaltyReasonId,
          scope: ReliabilityPenaltyScope.SCORE_SUBMISSION,
          userId: body.reliabilityPenaltyUserId,
          actorId: session.user.id,
          matchId: updated.id,
          tournamentId: updated.tournamentId,
          dedupeKey: `match-score-penalty:${updated.id}:${body.reliabilityPenaltyUserId}:${body.reliabilityPenaltyReasonId}`,
          comment: `Штраф выбран при ручном подтверждении счета ${updated.player1Score ?? 0}:${updated.player2Score ?? 0}.`,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "RELIABILITY_PENALTY_REASON_NOT_FOUND") {
          return NextResponse.json({ error: "Выбранный штраф надежности больше недоступен." }, { status: 400 });
        }
        throw error;
      }
    }
    await syncTournamentLifecycleStatus(updated.tournamentId);
  }

  if (updated.status === MatchStatus.FORFEIT) {
    const loserId = getForfeitLoserId(updated);
    if (loserId) {
      const dedupeKey = `match-forfeit:${updated.id}`;
      const technicalLossReason = "technicalLossReason" in body && body.technicalLossReason ? body.technicalLossReason : undefined;
      if ("reliabilityPenaltyReasonId" in body) {
        await removeConfiguredReliabilityPenaltiesByPrefix(`match-forfeit-config:${updated.id}:`);
      }
      if (!("reliabilityPenaltyReasonId" in body) && body.reliabilityPenaltyReasonId) {
        try {
          await applyConfiguredReliabilityPenalty({
            reasonId: body.reliabilityPenaltyReasonId,
            scope: ReliabilityPenaltyScope.TECHNICAL_LOSS,
            userId: loserId,
            matchId: updated.id,
            tournamentId: updated.tournamentId,
            actorId: session.user.id,
            dedupeKey: `match-forfeit-config:${updated.id}:${loserId}:${body.reliabilityPenaltyReasonId}`,
            comment: "Штраф выбран при выставлении технического поражения.",
          });
        } catch (error) {
          if (error instanceof Error && error.message === "RELIABILITY_PENALTY_REASON_NOT_FOUND") {
            return NextResponse.json({ error: "Выбранный штраф надежности больше недоступен." }, { status: 400 });
          }
          throw error;
        }
      } else if (technicalLossReason) {
        const result = await applyTechnicalLossPenalty({
          userId: loserId,
          matchId: updated.id,
          tournamentId: updated.tournamentId,
          actorId: session.user.id,
          dedupeKey,
          reason: technicalLossReason,
        });

        if (!result.created) {
          await db.reliabilityEvent.updateMany({
            where: { userId: loserId, dedupeKey },
            data: { reason: technicalLossReason },
          });
        }
      }
    }

    if (updated.bracketId && updated.isCaptainAssignedTeamMatch) {
      await resolveConfirmedMatch(updated.id);
    }
  }

  await logAdminAction({
    adminId: session.user.id,
    tournamentId: before.tournamentId,
    entityType: "MATCH",
    entityId: before.id,
    actionType: "UPDATE",
    beforeJson: before,
    afterJson: updated,
  });

  return NextResponse.json({ ok: true, match: updated, correctedMatches });
}
