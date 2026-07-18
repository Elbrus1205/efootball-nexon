import { NextRequest, NextResponse } from "next/server";
import { isAllowedCoverSource, optimizedImageUrl } from "@/lib/image-optimization";

const dataImagePattern = /^data:([^;,]+);base64,([\s\S]+)$/;
export const COVER_CACHE_CONTROL = "public, max-age=31536000, immutable";
const DEFAULT_COVER_WIDTH = 960;
const DEFAULT_COVER_HEIGHT = 540;
const DEFAULT_COVER_QUALITY = 84;

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
  const upstream = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8_000) });

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(null, { status: upstream.status || 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "image/png");
  headers.set("Cache-Control", COVER_CACHE_CONTROL);

  return new NextResponse(upstream.body, { headers });
}

function numberParam(searchParams: URLSearchParams, shortName: string, longName: string, fallback: number, max: number) {
  const raw = searchParams.get(shortName) ?? searchParams.get(longName);
  const value = raw ? Number(raw) : NaN;

  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.round(value), max);
}

function buildOptimizedCoverUrl(coverImage: string, request: NextRequest) {
  const url = new URL(coverImage, request.url);
  const width = numberParam(request.nextUrl.searchParams, "w", "width", DEFAULT_COVER_WIDTH, 1920);
  const height = numberParam(request.nextUrl.searchParams, "h", "height", DEFAULT_COVER_HEIGHT, 1080);
  const quality = numberParam(request.nextUrl.searchParams, "q", "quality", DEFAULT_COVER_QUALITY, 95);

  return new URL(
    optimizedImageUrl(url.toString(), {
      width,
      height,
      quality,
      resize: "cover",
      format: "webp",
    }) ?? url.toString(),
  );
}

export async function buildCoverImageResponse(coverImage: string, request: NextRequest) {
  if (coverImage.startsWith("http://") || coverImage.startsWith("https://") || coverImage.startsWith("/")) {
    if (!isAllowedCoverSource(coverImage, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      return new NextResponse(null, { status: 400 });
    }
    return proxyImageResponse(buildOptimizedCoverUrl(coverImage, request));
  }

  return buildBase64ImageResponse(coverImage);
}
