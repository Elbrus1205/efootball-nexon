import { NextRequest, NextResponse } from "next/server";
import { getTelegramWebhookSecret } from "@/lib/telegram-bot";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let webhookSecret: string;
  try {
    webhookSecret = getTelegramWebhookSecret();
  } catch {
    return NextResponse.json({ ok: false, error: "Webhook secret is not configured." }, { status: 500 });
  }

  if (request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
