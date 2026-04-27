import { NextRequest, NextResponse } from "next/server";
import { getConfiguredSiteBaseUrl, getRequestBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { logTelegramBotAuth } from "@/lib/telegram-bot-auth";
import { ensureTelegramWebhook, getTelegramBotIdentity } from "@/lib/telegram-bot";
import {
  buildPendingTelegramBotLoginIdentifier,
  createTelegramBotLoginToken,
  getTelegramBotLoginStartParam,
} from "@/lib/telegram-bot-login";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { legalAccepted?: boolean };
    const requestOrigin = new URL(request.url).origin;
    const baseUrl = /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(requestOrigin)
      ? getConfiguredSiteBaseUrl()
      : getRequestBaseUrl(request);
    const bot = await getTelegramBotIdentity();
    const webhook = await ensureTelegramWebhook(baseUrl);
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
      webhookAction: webhook.skipped ? webhook.reason : webhook.action,
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
