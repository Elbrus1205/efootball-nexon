import { NextResponse } from "next/server";
import { notifyUpcomingRoundDeadlineReminders } from "@/lib/services/tournaments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleDeadlineReminderCron(request);
}

export async function POST(request: Request) {
  return handleDeadlineReminderCron(request);
}

async function handleDeadlineReminderCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const providedSecret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-cron-secret")?.trim();

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await notifyUpcomingRoundDeadlineReminders();
  return NextResponse.json({ ok: true, ...result });
}
