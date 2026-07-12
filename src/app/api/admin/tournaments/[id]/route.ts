import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { addArchivedTournamentStats } from "@/lib/home-stats";
import { MatchStatus, UserRole } from "@prisma/client";
import {
  assignRandomClubsToTournament,
  closeTournamentRegistration,
  generateTournamentMatches,
  generateTournamentSchedule,
  generateTournamentStages,
  startTournament,
} from "@/lib/services/tournaments";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.createEdit");
  const formData = await request.formData();
  const method = formData.get("_method");
  const redirectUrl = new URL("/admin/tournaments", getRequestBaseUrl(request));
  try {
    await assertCanManageTournament(session, params.id);

    if (method === "delete") {
      if (session.user.role === UserRole.TRAINEE) {
        throw new Error("Практикант не может удалять турниры.");
      }

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
      if (session.user.role === UserRole.TRAINEE) {
        throw new Error("Практикант не может удалять или сбрасывать матчи турнира.");
      }

      const confirmedCount = await db.match.count({
        where: {
          tournamentId: params.id,
          status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED, MatchStatus.FORFEIT] },
        },
      });
      if (confirmedCount > 0) {
        throw new Error("Нельзя сбросить матчи: есть подтверждённые результаты.");
      }

      const existingMatchIds = await db.match
        .findMany({ where: { tournamentId: params.id }, select: { id: true } })
        .then((rows) => rows.map((r) => r.id));

      if (existingMatchIds.length > 0) {
        await db.matchResultSubmission.deleteMany({ where: { matchId: { in: existingMatchIds } } });
        await db.matchSchedule.deleteMany({ where: { matchId: { in: existingMatchIds } } });
      }
      await db.match.deleteMany({ where: { tournamentId: params.id } });

      const bracketIds = await db.playoffBracket
        .findMany({ where: { tournamentId: params.id }, select: { id: true } })
        .then((rows) => rows.map((r) => r.id));
      if (bracketIds.length > 0) {
        await db.bracketSlot.deleteMany({ where: { bracketId: { in: bracketIds } } });
      }

      const createdMatches = await generateTournamentMatches(params.id);
      if (!createdMatches.length) {
        throw new Error("Матчи удалены, но пересоздать не удалось — проверьте распределение участников по группам.");
      }

      await generateTournamentSchedule(params.id, { overwrite: true }).catch(() => null);
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
