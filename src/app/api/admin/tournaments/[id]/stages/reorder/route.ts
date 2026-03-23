import { AdminActionType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { stageReorderSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN]);
  const body = stageReorderSchema.parse({
    ...(await request.json()),
    tournamentId: params.id,
  });

  const before = await db.tournamentStage.findMany({
    where: { tournamentId: params.id },
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, orderIndex: true },
  });

  await db.$transaction(
    body.stageIds.map((stageId, index) =>
      db.tournamentStage.update({
        where: { id: stageId },
        data: { orderIndex: index + 1 },
      }),
    ),
  );

  const after = await db.tournamentStage.findMany({
    where: { tournamentId: params.id },
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true, orderIndex: true },
  });

  await logAdminAction({
    adminId: session.user.id,
    tournamentId: params.id,
    entityType: "STAGE_PIPELINE",
    entityId: params.id,
    actionType: AdminActionType.UPDATE,
    beforeJson: before,
    afterJson: after,
  });

  return NextResponse.json({ ok: true, stages: after });
}
