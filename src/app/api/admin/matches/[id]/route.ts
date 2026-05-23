import { MatchStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { recalculateGroupStandings } from "@/lib/services/tournaments";
import { matchUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAnyPermission(["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);
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
  if ("status" in body && body.status) data.status = body.status as MatchStatus;
  if ("notes" in body) data.notes = body.notes || null;

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
    before.participant1EntryId !== updated.participant1EntryId ||
    before.participant2EntryId !== updated.participant2EntryId;

  if (standingsRelevantChange) {
    await recalculateGroupStandings(before.tournamentId);
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
