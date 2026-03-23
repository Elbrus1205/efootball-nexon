import { AdminActionType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { matchReorderSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);
  const body = matchReorderSchema.parse(await request.json());

  const before = await db.match.findMany({
    where: {
      tournamentId: params.id,
      id: { in: body.matchIds },
    },
    orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
    select: { id: true, round: true, matchNumber: true },
  });

  await db.$transaction(
    body.matchIds.map((matchId, index) =>
      db.match.update({
        where: { id: matchId },
        data: { matchNumber: index + 1 },
      }),
    ),
  );

  const after = await db.match.findMany({
    where: {
      tournamentId: params.id,
      id: { in: body.matchIds },
    },
    orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
    select: { id: true, round: true, matchNumber: true },
  });

  await logAdminAction({
    adminId: session.user.id,
    tournamentId: params.id,
    entityType: "MATCH_BOARD",
    entityId: params.id,
    actionType: AdminActionType.UPDATE,
    beforeJson: before,
    afterJson: after,
  });

  return NextResponse.json({ ok: true, matches: after });
}
