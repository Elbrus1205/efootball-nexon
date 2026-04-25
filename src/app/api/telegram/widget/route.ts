import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  let response: Response;
  try {
    response = await fetch("https://telegram.org/js/telegram-widget.js?22", {
      next: { revalidate: 86400 },
      headers: {
        "User-Agent": "Mozilla/5.0 efootball-nexon widget proxy",
        Accept: "application/javascript,*/*;q=0.8",
      },
    });
  } catch {
    return new NextResponse("", {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  if (!response.ok) {
    return new NextResponse("", {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
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
