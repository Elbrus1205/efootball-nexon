import { ParticipantStatus, TournamentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autoAssignExpiredCaptainTeamMatchSlots, syncTournamentLifecycleStatus } from "@/lib/services/tournaments";

export const dynamic = "force-dynamic";

async function handleLifecycleCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const providedSecret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-cron-secret")?.trim();

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const autoAssignment = await autoAssignExpiredCaptainTeamMatchSlots(now);
  const candidates = await db.tournament.findMany({
    where: {
      OR: [
        {
          status: TournamentStatus.DRAFT,
          autoOpenRegistration: true,
          OR: [{ registrationStartsAt: { lte: now } }, { registrationStartsAt: null, startsAt: { lte: now } }],
        },
        { status: TournamentStatus.REGISTRATION_OPEN },
      ],
    },
    select: {
      id: true,
      status: true,
      maxParticipants: true,
      _count: {
        select: { participants: { where: { status: ParticipantStatus.CONFIRMED } } },
      },
    },
  });

  const due = candidates.filter(
    (tournament) =>
      tournament.status === TournamentStatus.DRAFT ||
      tournament._count.participants >= tournament.maxParticipants,
  );
  const results = [];

  for (const tournament of due) {
    try {
      await syncTournamentLifecycleStatus(tournament.id);
      results.push({ id: tournament.id, ok: true });
    } catch (error) {
      console.error("Tournament lifecycle cron failed", {
        tournamentId: tournament.id,
        error: error instanceof Error ? error.message : "unknown-error",
      });
      results.push({ id: tournament.id, ok: false });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results, autoAssignment });
}

export async function GET(request: Request) {
  return handleLifecycleCron(request);
}

export async function POST(request: Request) {
  return handleLifecycleCron(request);
}
