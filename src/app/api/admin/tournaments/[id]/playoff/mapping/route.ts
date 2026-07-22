import { AdminActionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { savePlayoffMapping } from "@/lib/services/tournaments";
import { invalidateTournamentSchedule, invalidateTournamentStructure } from "@/lib/tournament-cache";
import { playoffMappingSchema } from "@/lib/validators";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.manageStructure");
  await assertCanManageTournament(session, params.id);
  const body = playoffMappingSchema.parse(await request.json());
  const bracket = await db.playoffBracket.findFirst({
    where: { id: body.bracketId, tournamentId: params.id },
    select: { id: true },
  });

  if (!bracket) {
    return NextResponse.json({ error: "Сетка турнира не найдена." }, { status: 404 });
  }

  const slots = await savePlayoffMapping({
    tournamentId: params.id,
    bracketId: body.bracketId,
    mappings: body.mappings,
  });

  await logAdminAction({
    adminId: session.user.id,
    tournamentId: params.id,
    entityType: "PLAYOFF_MAPPING",
    entityId: body.bracketId,
    actionType: AdminActionType.UPDATE,
    afterJson: body.mappings,
  });

  invalidateTournamentStructure(params.id);
  invalidateTournamentSchedule(params.id);

  return NextResponse.json({ ok: true, slots });
}
