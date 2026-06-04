import { NextResponse } from "next/server";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { setBracketSlot } from "@/lib/services/tournaments";
import { bracketSlotSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requirePermission("tournaments.manageStructure");
  await assertCanManageTournament(session, params.id);
  const body = bracketSlotSchema.parse(await request.json());
  const bracket = await db.playoffBracket.findFirst({
    where: { id: body.bracketId, tournamentId: params.id },
    select: { id: true },
  });

  if (!bracket) {
    return NextResponse.json({ error: "Сетка турнира не найдена." }, { status: 404 });
  }

  const slot = await setBracketSlot(body);
  await logAdminAction({
    adminId: session.user.id,
    tournamentId: params.id,
    entityType: "BRACKET_SLOT",
    entityId: slot.id,
    actionType: "UPDATE",
    afterJson: slot,
  });

  return NextResponse.json({ ok: true, slot });
}
