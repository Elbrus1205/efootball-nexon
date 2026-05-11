import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/services/admin-actions";
import { setBracketSlot } from "@/lib/services/tournaments";
import { bracketSlotSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requirePermission("tournaments.manageStructure");
  const body = bracketSlotSchema.parse(await request.json());

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
