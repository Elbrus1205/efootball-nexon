import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildCoverImageResponse } from "@/lib/cover-image-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const settings = await db.divisionSettings.findUnique({
    where: { id: "default" },
    select: { coverImage: true },
  });

  const coverImage = settings?.coverImage?.trim();

  if (!coverImage) {
    return new NextResponse(null, { status: 404 });
  }

  return buildCoverImageResponse(coverImage, request);
}
