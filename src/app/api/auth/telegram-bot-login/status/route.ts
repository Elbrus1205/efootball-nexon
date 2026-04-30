import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logTelegramBotAuth } from "@/lib/telegram-bot-auth";
import { parseTelegramBotLoginIdentifier } from "@/lib/telegram-bot-login";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ status: "missing" }, { status: 400 });
  }

  logTelegramBotAuth("token-received", { token, source: "status-route" });

  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    logTelegramBotAuth("login-failure", {
      token,
      source: "status-route",
      reason: record ? "expired-token" : "missing-token",
    });
    return NextResponse.json({ status: "expired" });
  }

  const parsed = parseTelegramBotLoginIdentifier(record.identifier);
  if (!parsed) {
    logTelegramBotAuth("login-failure", {
      token,
      source: "status-route",
      reason: "invalid-token-payload",
    });
    return NextResponse.json({ status: "expired" });
  }

  return NextResponse.json({
    status: parsed.status,
    expiresAt: record.expires.toISOString(),
  });
}
