import { ParticipantStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = performance.now();

  try {
    const tournaments = await db.tournament.findMany({
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
