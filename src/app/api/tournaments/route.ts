import { ParticipantStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function canSeeTestTournaments(role?: string | null) {
  return role === "FOUNDER" || role === "ADMIN" || role === "ORGANIZER" || role === "JUDGE" || role === "TRAINEE";
}

export async function GET() {
  const start = performance.now();

  try {
    const session = await getCurrentSession();
    const currentRole = session?.user.role ?? null;
    const tournaments = await db.tournament.findMany({
      where: canSeeTestTournaments(currentRole) ? undefined : { isTest: false },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        coverImage: true,
        prizePool: true,
        format: true,
        playoffType: true,
        status: true,
        startsAt: true,
        registrationStartsAt: true,
        registrationEndsAt: true,
        maxParticipants: true,
        clubSelectionMode: true,
        _count: { select: { participants: { where: { status: { not: ParticipantStatus.REMOVED } } } } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json({ tournaments });
  } finally {
    console.log("Tournaments API:", performance.now() - start);
  }
}
