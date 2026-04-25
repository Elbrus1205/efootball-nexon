import { NextRequest, NextResponse } from "next/server";
import { isTelegramAssetUrl } from "@/lib/telegram-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxImageBytes = 6 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Image URL is required." }, { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Image URL is invalid." }, { status: 400 });
  }

  if (imageUrl.protocol !== "https:" || !isTelegramAssetUrl(imageUrl.toString())) {
    return NextResponse.json({ error: "Image host is not allowed." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(imageUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 efootball-nexon image proxy",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image is unavailable." }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: "Image is unavailable." }, { status: response.status });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "URL does not point to an image." }, { status: 415 });
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxImageBytes) {
    return NextResponse.json({ error: "Image is too large." }, { status: 413 });
  }

  const body = await response.arrayBuffer();
  if (body.byteLength > maxImageBytes) {
    return NextResponse.json({ error: "Image is too large." }, { status: 413 });
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
