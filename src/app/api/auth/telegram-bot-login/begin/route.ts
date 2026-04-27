import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logTelegramBotAuth } from "@/lib/telegram-bot-auth";
import { getConfiguredTelegramBotIdentity } from "@/lib/telegram-bot";
import {
  buildPendingTelegramBotLoginIdentifier,
  createTelegramBotLoginToken,
  getTelegramBotLoginStartParam,
} from "@/lib/telegram-bot-login";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { legalAccepted?: boolean };
    const bot = getConfiguredTelegramBotIdentity();
    if (!bot?.username) {
      throw new Error("Telegram bot username is not configured");
    }

    const token = createTelegramBotLoginToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.verificationToken.create({
      data: {
        token,
        identifier: buildPendingTelegramBotLoginIdentifier(Boolean(body.legalAccepted)),
        expires: expiresAt,
      },
    });

    logTelegramBotAuth("token-created", {
      token,
      botUsername: bot.username,
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json({
      token,
      botId: bot.id,
      botUsername: bot.username,
      botUrl: `https://t.me/${bot.username}?start=${getTelegramBotLoginStartParam(token)}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    logTelegramBotAuth("login-failure", {
      reason: "begin-route-failed",
      error: error instanceof Error ? error.message : "unknown-error",
    });

    return NextResponse.json(
      { error: "Не удалось подготовить вход через Telegram. Проверьте настройки бота и webhook." },
      { status: 500 },
    );
  }
}
