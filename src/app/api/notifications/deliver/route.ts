import { NextResponse } from "next/server";
import { deliverNotificationOutbox } from "@/lib/notifications/delivery-worker";

export const dynamic = "force-dynamic";

async function handleDeliveryCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const providedSecret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-cron-secret")?.trim();

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, ...(await deliverNotificationOutbox()) });
}

export async function GET(request: Request) {
  return handleDeliveryCron(request);
}

export async function POST(request: Request) {
  return handleDeliveryCron(request);
}
