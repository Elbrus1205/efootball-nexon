import { MatchStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { matchUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);
  const body = matchUpdateSchema.parse(await request.json());

  const before = await db.match.findUnique({
    where: { id: params.id },
  });

  if (!before) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const updated = await db.match.update({
    where: { id: params.id },
    data: {
      player1Id: body.player1Id || null,
      player2Id: body.player2Id || null,
      participant1EntryId: body.participant1EntryId || null,
      participant2EntryId: body.participant2EntryId || null,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      player1Score: body.player1Score,
      player2Score: body.player2Score,
      status: (body.status as MatchStatus | "") || undefined,
      notes: body.notes || null,
    },
  });

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
