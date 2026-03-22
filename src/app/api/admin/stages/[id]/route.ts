import { NextResponse } from "next/server";
import { StageStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { stageUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);

  const payload = await request.json();
  const body = stageUpdateSchema.parse({
    ...payload,
    stageId: params.id,
  });

  const stage = await db.tournamentStage.update({
    where: { id: params.id },
    data: {
      name: body.name,
      status: body.status as StageStatus | undefined,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
    },
  });

  return NextResponse.json({ ok: true, stage });
}
