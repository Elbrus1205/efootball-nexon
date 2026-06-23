import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const dataImagePattern = /^data:([^;,]+);base64,([\s\S]+)$/;
const COVER_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const dynamic = "force-dynamic";

function buildImageResponse(coverImage: string) {
  const dataImage = coverImage.match(dataImagePattern);

  if (dataImage) {
    return new NextResponse(Buffer.from(dataImage[2], "base64"), {
      headers: {
        "Content-Type": dataImage[1],
        "Cache-Control": COVER_CACHE_CONTROL,
      },
    });
  }

  return new NextResponse(Buffer.from(coverImage, "base64"), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": COVER_CACHE_CONTROL,
    },
  });
}

export async function GET(request: NextRequest) {
  const settings = await db.divisionSettings.findUnique({
    where: { id: "default" },
    select: { coverImage: true },
  });

  const coverImage = settings?.coverImage?.trim();

  if (!coverImage) {
    return new NextResponse(null, { status: 404 });
  }

  if (coverImage.startsWith("http://") || coverImage.startsWith("https://") || coverImage.startsWith("/")) {
    const response = NextResponse.redirect(new URL(coverImage, request.url));
    response.headers.set("Cache-Control", COVER_CACHE_CONTROL);
    return response;
  }

  return buildImageResponse(coverImage);
}
