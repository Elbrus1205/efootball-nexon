import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseTelegramBotLoginIdentifier } from "@/lib/telegram-bot-login";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ status: "missing" }, { status: 400 });
  }

  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return NextResponse.json({ status: "expired" });
  }

  const parsed = parseTelegramBotLoginIdentifier(record.identifier);
  if (!parsed) {
    return NextResponse.json({ status: "expired" });
  }

  return NextResponse.json({ status: parsed.status });
}
