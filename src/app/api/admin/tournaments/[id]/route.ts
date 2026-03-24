import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { closeTournamentRegistration, generateTournamentMatches, generateTournamentSchedule, generateTournamentStages } from "@/lib/services/tournaments";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);
  const formData = await request.formData();
  const method = formData.get("_method");

  if (method === "delete") {
    await db.tournament.delete({ where: { id: params.id } });
  }

  if (method === "close") {
    await closeTournamentRegistration(params.id);
  }

  if (method === "generate-stages") {
    await generateTournamentStages(params.id, { regenerate: true });
  }

  if (method === "generate-matches") {
    await generateTournamentMatches(params.id);
    const tournament = await db.tournament.findUnique({
      where: { id: params.id },
      select: { autoCreateSchedule: true },
    });
    if (tournament?.autoCreateSchedule) {
      await generateTournamentSchedule(params.id, { overwrite: true });
    }
  }

  if (method === "generate-schedule") {
    await generateTournamentSchedule(params.id, { overwrite: true });
  }

  return NextResponse.redirect(new URL("/admin/tournaments", process.env.NEXTAUTH_URL));
}
