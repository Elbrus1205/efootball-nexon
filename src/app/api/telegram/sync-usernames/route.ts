import { NextResponse } from "next/server";
import { syncAllTelegramUsernames } from "@/lib/services/telegram-username-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleTelegramUsernameSyncCron(request);
}

export async function POST(request: Request) {
  return handleTelegramUsernameSyncCron(request);
}

async function handleTelegramUsernameSyncCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const providedSecret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-cron-secret")?.trim();

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await syncAllTelegramUsernames();
  return NextResponse.json({ ok: true, ...summary });
}
