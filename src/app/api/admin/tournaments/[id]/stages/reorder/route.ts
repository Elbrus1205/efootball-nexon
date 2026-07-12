import { AdminActionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { stageReorderSchema } from "@/lib/validators";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.manageStructure");
  await assertCanManageTournament(session, params.id);
  const body = stageReorderSchema.parse({
    ...(await request.json()),
    tournamentId: params.id,
  });
  const stageCount = await db.tournamentStage.count({
    where: {
      tournamentId: params.id,
      id: { in: body.stageIds },
    },
  });

  if (stageCount !== body.stageIds.length) {
    return NextResponse.json({ error: "Этап турнира не найден." }, { status: 404 });
  }

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
