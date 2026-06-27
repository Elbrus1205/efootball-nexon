import { MatchStatus, Prisma, type Match } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertCanManageMatch } from "@/lib/admin-tournament-access";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { applyTechnicalLossPenalty, recordConfirmedMatchReliability } from "@/lib/services/reliability";
import { recalculateGroupStandings, resolveConfirmedMatch, syncTournamentLifecycleStatus } from "@/lib/services/tournaments";
import { matchUpdateSchema } from "@/lib/validators";

function matchRequiresWinner(match: {
  bracketId: string | null;
  isPenaltyTiebreak: boolean;
  seriesWinsRequired: number | null;
}) {
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
  return Boolean(match.bracketId && match.seriesKey && !match.isPenaltyTiebreak && !(match.seriesWinsRequired && match.seriesWinsRequired > 1));
}

function getForfeitLoserId(match: Pick<Match, "player1Id" | "player2Id" | "winnerId" | "player1Score" | "player2Score">) {
  if (match.winnerId && match.player1Id === match.winnerId) return match.player2Id;
  if (match.winnerId && match.player2Id === match.winnerId) return match.player1Id;
  if (match.player1Score !== null && match.player2Score !== null && match.player1Score > match.player2Score) return match.player2Id;
  if (match.player1Score !== null && match.player2Score !== null && match.player2Score > match.player1Score) return match.player1Id;
  return null;
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAnyPermission(["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);
  await assertCanManageMatch(session, params.id);
  const body = matchUpdateSchema.parse(await request.json());

  const before = await db.match.findUnique({
    where: { id: params.id },
  });

  if (!before) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
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
  const statusExplicitlyChanged = "status" in body && Boolean(body.status);
  const multiLegPenaltyDecision = await getMultiLegPenaltyDecision(before, nextPlayer1Score, nextPlayer2Score);

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

  const updated = await db.match.update({
    where: { id: params.id },
    data,
  });

  const standingsRelevantChange =
    before.groupId ||
    updated.groupId ||
    before.status !== updated.status ||
    before.player1Score !== updated.player1Score ||
    before.player2Score !== updated.player2Score ||
    before.player1PenaltyScore !== updated.player1PenaltyScore ||
    before.player2PenaltyScore !== updated.player2PenaltyScore ||
    before.winnerId !== updated.winnerId ||
    before.participant1EntryId !== updated.participant1EntryId ||
    before.participant2EntryId !== updated.participant2EntryId;

  if (standingsRelevantChange) {
    await recalculateGroupStandings(before.tournamentId);
  }

  if (updated.status === MatchStatus.CONFIRMED || updated.status === MatchStatus.FINISHED) {
    await resolveConfirmedMatch(updated.id);
    await recordConfirmedMatchReliability({
      userIds: [updated.player1Id, updated.player2Id],
      matchId: updated.id,
      tournamentId: updated.tournamentId,
    });
    await syncTournamentLifecycleStatus(updated.tournamentId);
  }

  if (updated.status === MatchStatus.FORFEIT) {
    const loserId = getForfeitLoserId(updated);
    if (loserId) {
      const dedupeKey = `match-forfeit:${updated.id}`;
      const technicalLossReason = "technicalLossReason" in body && body.technicalLossReason ? body.technicalLossReason : undefined;
      const result = await applyTechnicalLossPenalty({
        userId: loserId,
        matchId: updated.id,
        tournamentId: updated.tournamentId,
        actorId: session.user.id,
        dedupeKey,
        reason: technicalLossReason,
      });

      if (!result.created && technicalLossReason) {
        await db.reliabilityEvent.updateMany({
          where: { userId: loserId, dedupeKey },
          data: { reason: technicalLossReason },
        });
      }
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

  return NextResponse.json({ ok: true, match: updated });
}
