import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTelegramWebhookSecret } from "@/lib/telegram-bot";

export const runtime = "nodejs";

type TelegramWebhookUser = {
  id?: number | string;
  username?: string;
};

type TelegramWebhookUpdate = {
  message?: { from?: TelegramWebhookUser };
  edited_message?: { from?: TelegramWebhookUser };
  callback_query?: { from?: TelegramWebhookUser };
};

function normalizeTelegramUsername(value?: string | null) {
  const username = value?.trim().replace(/^@/, "");
  return username && /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : null;
}

async function syncTelegramUsernameFromWebhook(update: TelegramWebhookUpdate) {
  const from = update.message?.from ?? update.edited_message?.from ?? update.callback_query?.from;
  const telegramId = from?.id === undefined || from.id === null ? null : String(from.id).trim();
  if (!telegramId || !/^\d+$/.test(telegramId)) return;

  await db.user.updateMany({
    where: { telegramId },
    data: { telegramUsername: normalizeTelegramUsername(from?.username) },
  });
}

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

  const update = (await request.json().catch(() => null)) as TelegramWebhookUpdate | null;
  if (update) {
    await syncTelegramUsernameFromWebhook(update);
  }

  return NextResponse.json({ ok: true });
}
