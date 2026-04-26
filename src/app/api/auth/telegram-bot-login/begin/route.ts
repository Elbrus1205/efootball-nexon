import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildPendingTelegramBotLoginIdentifier,
  createTelegramBotLoginToken,
  getTelegramBotLoginStartParam,
} from "@/lib/telegram-bot-login";

export async function POST(request: NextRequest) {
  const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME)?.trim().replace(/^@/, "");
  if (!botUsername || !/^[A-Za-z0-9_]{5,32}$/.test(botUsername)) {
    return NextResponse.json({ error: "Telegram-бот не настроен." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { legalAccepted?: boolean };
  const token = createTelegramBotLoginToken();
  const startParam = getTelegramBotLoginStartParam(token);

  await db.verificationToken.create({
    data: {
      token,
      identifier: buildPendingTelegramBotLoginIdentifier(Boolean(body.legalAccepted)),
      expires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return NextResponse.json({
    token,
    botUrl: `https://t.me/${botUsername}?start=${startParam}`,
  });
}
