import { NextResponse } from "next/server";
import { StageStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { stageUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN]);

  const payload = await request.json();
  const body = stageUpdateSchema.parse({
    ...payload,
    stageId: params.id,
  });

  const before = await db.tournamentStage.findUnique({ where: { id: params.id } });
  const stage = await db.tournamentStage.update({
    where: { id: params.id },
    data: {
      name: body.name,
      status: body.status as StageStatus | undefined,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
    },
  });

  await logAdminAction({
    adminId: session.user.id,
    tournamentId: stage.tournamentId,
    entityType: "TOURNAMENT_STAGE",
    entityId: stage.id,
    actionType: "UPDATE",
    beforeJson: before,
    afterJson: stage,
  });

  return NextResponse.json({ ok: true, stage });
}
