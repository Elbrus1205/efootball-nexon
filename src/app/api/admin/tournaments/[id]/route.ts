import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  assignRandomClubsToTournament,
  closeTournamentRegistration,
  generateTournamentMatches,
  generateTournamentSchedule,
  generateTournamentStages,
  startTournament,
} from "@/lib/services/tournaments";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);
  const formData = await request.formData();
  const method = formData.get("_method");
  const redirectUrl = new URL("/admin/tournaments", request.url);
  try {
    if (method === "delete") {
      await db.tournament.delete({ where: { id: params.id } });
    }

    if (method === "close") {
      await closeTournamentRegistration(params.id);
    }

    if (method === "start") {
      await startTournament(params.id);
    }

    if (method === "generate-stages") {
      await generateTournamentStages(params.id, { regenerate: true });
    }

    if (method === "generate-matches") {
      await generateTournamentMatches(params.id);
      await generateTournamentSchedule(params.id, { overwrite: true });
    }

    if (method === "assign-random-clubs") {
      await assignRandomClubsToTournament(params.id);
    }
  } catch (error) {
    redirectUrl.searchParams.set("warning", error instanceof Error ? error.message : "Не удалось выполнить действие.");
  }

  return NextResponse.redirect(redirectUrl, 303);
}
