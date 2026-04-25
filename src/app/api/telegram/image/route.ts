import { NextRequest, NextResponse } from "next/server";
import { isTelegramAssetUrl } from "@/lib/telegram-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxImageBytes = 6 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId")?.trim();
  if (fileId) {
    if (!/^[A-Za-z0-9_-]{10,256}$/.test(fileId)) {
      return NextResponse.json({ error: "File ID is invalid." }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "Telegram bot token is not configured." }, { status: 500 });
    }

    const fileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`, {
      cache: "no-store",
    }).catch(() => null);

    if (!fileResponse?.ok) {
      return NextResponse.json({ error: "Image is unavailable." }, { status: 502 });
    }

    const filePayload = (await fileResponse.json().catch(() => null)) as { ok?: boolean; result?: { file_path?: string } } | null;
    const filePath = filePayload?.result?.file_path;
    if (!filePayload?.ok || !filePath) {
      return NextResponse.json({ error: "Image is unavailable." }, { status: 502 });
    }

    const imageResponse = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 efootball-nexon image proxy",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
    }).catch(() => null);

    if (!imageResponse?.ok) {
      return NextResponse.json({ error: "Image is unavailable." }, { status: 502 });
    }

    const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
    const body = await imageResponse.arrayBuffer();
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
