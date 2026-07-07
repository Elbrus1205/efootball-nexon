import { NextRequest, NextResponse } from "next/server";

const dataImagePattern = /^data:([^;,]+);base64,([\s\S]+)$/;
export const COVER_CACHE_CONTROL = "public, max-age=31536000, immutable";

function buildBase64ImageResponse(coverImage: string) {
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

async function proxyImageResponse(url: URL) {
  const upstream = await fetch(url, { redirect: "follow" });

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(null, { status: upstream.status || 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "image/png");
  headers.set("Cache-Control", COVER_CACHE_CONTROL);

  return new NextResponse(upstream.body, { headers });
}

export async function buildCoverImageResponse(coverImage: string, request: NextRequest) {
  if (coverImage.startsWith("http://") || coverImage.startsWith("https://") || coverImage.startsWith("/")) {
    return proxyImageResponse(new URL(coverImage, request.url));
  }

  return buildBase64ImageResponse(coverImage);
}
