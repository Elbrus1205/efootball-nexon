import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { addArchivedTournamentStats } from "@/lib/home-stats";
import { MatchStatus } from "@prisma/client";
import {
  assignRandomClubsToTournament,
  closeTournamentRegistration,
  generateTournamentMatches,
  generateTournamentSchedule,
  generateTournamentStages,
  startTournament,
} from "@/lib/services/tournaments";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requirePermission("tournaments.createEdit");
  const formData = await request.formData();
  const method = formData.get("_method");
  const redirectUrl = new URL("/admin/tournaments", getRequestBaseUrl(request));
  try {
    if (method === "delete") {
      const preserveHomeStats = formData.get("preserveHomeStats") === "on";

      await db.$transaction(async (tx) => {
        const tournament = await tx.tournament.findUnique({
          where: { id: params.id },
          select: { prizePool: true },
        });

        if (!tournament) {
          throw new Error("Турнир не найден.");
        }

        if (preserveHomeStats) {
          await addArchivedTournamentStats(tournament, tx);
        }

        await tx.tournament.delete({ where: { id: params.id } });
      });
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

    if (method === "reset-matches") {
      const confirmedCount = await db.match.count({
        where: {
          tournamentId: params.id,
          status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED, MatchStatus.FORFEIT] },
        },
      });
      if (confirmedCount > 0) {
        throw new Error("Нельзя сбросить матчи: есть подтверждённые результаты.");
      }
      await db.matchResultSubmission.deleteMany({ where: { match: { tournamentId: params.id } } });
      await db.matchSchedule.deleteMany({ where: { match: { tournamentId: params.id } } });
      await db.match.deleteMany({ where: { tournamentId: params.id } });
      await db.bracketSlot.deleteMany({ where: { bracket: { tournamentId: params.id } } });
      await generateTournamentMatches(params.id);
      await generateTournamentSchedule(params.id, { overwrite: true });
      redirectUrl.searchParams.set("warning", "Матчи успешно пересозданы.");
    }

    if (method === "assign-random-clubs") {
      await assignRandomClubsToTournament(params.id);
    }
  } catch (error) {
    redirectUrl.searchParams.set("warning", error instanceof Error ? error.message : "Не удалось выполнить действие.");
  }

  return NextResponse.redirect(redirectUrl, 303);
}
