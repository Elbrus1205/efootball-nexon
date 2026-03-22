import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { standingUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const payload = await request.json();
  const body = standingUpdateSchema.parse({
    ...payload,
    standingId: params.id,
  });

  const standing = await db.groupStanding.update({
    where: { id: params.id },
    data: {
      rank: body.rank,
      points: body.points,
      goalDifference: body.goalDifference,
      played: body.played,
      wins: body.wins,
      draws: body.draws,
      losses: body.losses,
      goalsFor: body.goalsFor,
      goalsAgainst: body.goalsAgainst,
    },
    include: {
      participant: { include: { user: true } },
    },
  });

  return NextResponse.json({ ok: true, standing });
}
