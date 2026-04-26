import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch("https://telegram.org/js/telegram-widget.js?22", {
    headers: {
      "User-Agent": "Mozilla/5.0 efootball-nexon widget proxy",
      Accept: "application/javascript,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    return new NextResponse("", { status: response.status });
  }

  const script = (await response.text()).replace(
    "if (origin == 'https://telegram.org') {",
    "if (origin == 'https://telegram.org' || origin == location.origin) {",
  );

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
