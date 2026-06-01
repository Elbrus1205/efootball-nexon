import { NextResponse } from "next/server";
import { notifyExpiredProfileStatuses } from "@/lib/profile-statuses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleProfileStatusExpirationCron(request);
}

export async function POST(request: Request) {
  return handleProfileStatusExpirationCron(request);
}

async function handleProfileStatusExpirationCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const providedSecret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-cron-secret")?.trim();

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await notifyExpiredProfileStatuses();
  return NextResponse.json({ ok: true, ...result });
}
