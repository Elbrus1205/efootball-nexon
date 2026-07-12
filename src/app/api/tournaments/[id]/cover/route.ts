import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildCoverImageResponse } from "@/lib/cover-image-response";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    select: { coverImage: true },
  });

  const coverImage = tournament?.coverImage?.trim();

  if (!coverImage) {
    return new NextResponse(null, { status: 404 });
  }

  return buildCoverImageResponse(coverImage, request);
}
