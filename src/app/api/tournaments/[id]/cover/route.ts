import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const dataImagePattern = /^data:([^;,]+);base64,([\s\S]+)$/;

function buildImageResponse(coverImage: string) {
  const dataImage = coverImage.match(dataImagePattern);

  if (dataImage) {
    return new NextResponse(Buffer.from(dataImage[2], "base64"), {
      headers: {
        "Content-Type": dataImage[1],
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    });
  }

  return new NextResponse(Buffer.from(coverImage, "base64"), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    select: { coverImage: true },
  });

  const coverImage = tournament?.coverImage?.trim();

  if (!coverImage) {
    return new NextResponse(null, { status: 404 });
  }

  if (coverImage.startsWith("http://") || coverImage.startsWith("https://") || coverImage.startsWith("/")) {
    return NextResponse.redirect(new URL(coverImage, request.url));
  }

  return buildImageResponse(coverImage);
}
