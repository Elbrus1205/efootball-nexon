import { AdminActionType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/services/admin-actions";
import { savePlayoffMapping } from "@/lib/services/tournaments";
import { playoffMappingSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN]);
  const body = playoffMappingSchema.parse(await request.json());

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

  return NextResponse.json({ ok: true, slots });
}
