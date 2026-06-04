import { ParticipantStatus } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function canSeeTestTournaments(role?: string | null) {
  return role === "FOUNDER" || role === "ADMIN" || role === "ORGANIZER" || role === "JUDGE" || role === "TRAINEE";
}

async function getCurrentRoleFromToken() {
  const requestHeaders = headers();
  const token = await getToken({
    req: { headers: Object.fromEntries(requestHeaders.entries()), cookies: {} } as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });

  return typeof token?.role === "string" ? token.role : null;
}

export async function GET() {
  const start = performance.now();

  try {
    const currentRole = await getCurrentRoleFromToken();
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
