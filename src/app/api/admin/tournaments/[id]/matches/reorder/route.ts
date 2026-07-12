import { AdminActionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { matchReorderSchema } from "@/lib/validators";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAnyPermission(["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);
  await assertCanManageTournament(session, params.id);
  const body = matchReorderSchema.parse(await request.json());
  const matchCount = await db.match.count({
    where: {
      tournamentId: params.id,
      id: { in: body.matchIds },
    },
  });

  if (matchCount !== body.matchIds.length) {
    return NextResponse.json({ error: "Матч турнира не найден." }, { status: 404 });
  }

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
