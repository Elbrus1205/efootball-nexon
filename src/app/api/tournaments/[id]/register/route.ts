import { NextResponse } from "next/server";
import { TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: { participants: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return NextResponse.json({ error: "Registration closed" }, { status: 400 });
  }

  if (tournament.participants.length >= tournament.maxParticipants) {
    return NextResponse.json({ error: "Limit reached" }, { status: 400 });
  }

  await db.tournamentRegistration.create({
    data: {
      tournamentId: params.id,
      userId: session.user.id,
    },
  });

  return NextResponse.redirect(new URL(`/tournaments/${params.id}`, process.env.NEXTAUTH_URL));
}
