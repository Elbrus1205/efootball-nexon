import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: { include: { user: true, group: true } },
      matches: { include: { player1: true, player2: true, winner: true, stage: true, group: true, schedules: true } },
      stages: {
        include: {
          groups: {
            include: {
              standings: {
                include: { participant: { include: { user: true } } },
              },
            },
          },
          bracket: {
            include: {
              slots: true,
              matches: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ tournament });
}
