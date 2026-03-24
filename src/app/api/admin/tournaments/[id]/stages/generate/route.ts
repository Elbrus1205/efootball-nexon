import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { generateTournamentMatches, generateTournamentSchedule, generateTournamentStages } from "@/lib/services/tournaments";
import { stageGenerationSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);

  const body = stageGenerationSchema.parse(await request.json().catch(() => ({})));
  const stages = await generateTournamentStages(params.id, { regenerate: body.regenerate });

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    select: { autoCreateMatches: true, autoCreateSchedule: true },
  });

  if (tournament?.autoCreateMatches) {
    await generateTournamentMatches(params.id);
  }

  if (tournament?.autoCreateSchedule) {
    await generateTournamentSchedule(params.id, { overwrite: true });
  }

  return NextResponse.json({ ok: true, stages });
}
