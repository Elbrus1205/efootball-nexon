import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { generateTournamentStages } from "@/lib/services/tournaments";
import { stageGenerationSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);

  const body = stageGenerationSchema.parse(await request.json().catch(() => ({})));
  const stages = await generateTournamentStages(params.id, { regenerate: body.regenerate });

  return NextResponse.json({ ok: true, stages });
}
