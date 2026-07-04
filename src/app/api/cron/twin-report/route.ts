import { NextResponse } from "next/server";
import { sendDailyTwinReport } from "@/lib/auth/twin-detection";

export const dynamic = "force-dynamic";

/**
 * Ежедневная сводка по твинк-аккаунтам. Защищено секретом CRON_SECRET:
 * Vercel Cron передаёт его в заголовке Authorization: Bearer <secret>.
 * Если CRON_SECRET не задан — роут отключён (503), чтобы не открывать его публично.
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const providedSecret =
    authHeader?.replace(/^Bearer\s+/i, "").trim() || request.headers.get("x-cron-secret")?.trim();

  if (providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendDailyTwinReport();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Twin report cron failed", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
