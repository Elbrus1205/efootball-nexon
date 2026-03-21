import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const tournaments = await db.tournament.findMany({
    include: { _count: { select: { participants: true } } },
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json({ tournaments });
}
