import { NextRequest, NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { buildVerifiedTelegramBotLoginIdentifier, parseTelegramBotLoginStartParam } from "@/lib/telegram-bot-login";

export const runtime = "nodejs";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: {
      id?: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
};

async function sendTelegramMessage(chatId: string, text: string, siteUrl: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: "Вернуться на сайт", url: siteUrl }]],
      },
    }),
  }).catch(() => null);
}

async function getTelegramPhotoFileId(telegramId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${telegramId}&limit=1`, {
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) return null;

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: { photos?: Array<Array<{ file_id?: string; file_size?: number }>> };
  } | null;
  const photos = payload?.result?.photos?.[0] ?? [];
  const bestPhoto = photos
    .filter((photo) => photo.file_id)
    .sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];

  return bestPhoto?.file_id ?? null;
}

export async function POST(request: NextRequest) {
  const siteUrl = getRequestBaseUrl(request);
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ ok: false, error: "Webhook secret is not configured." }, { status: 500 });
  }

  if (request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const text = update?.message?.text ?? "";
  const startPayload = text.match(/^\/start(?:@\w+)?\s+(.+)$/)?.[1];
  const token = parseTelegramBotLoginStartParam(startPayload);
  const from = update?.message?.from;
  const chatId = update?.message?.chat?.id?.toString();

  if (!token || !from?.id || !chatId) {
    return NextResponse.json({ ok: true });
  }

  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    await sendTelegramMessage(chatId, "Ссылка для входа истекла. Откройте сайт и нажмите вход через Telegram ещё раз.", siteUrl);
    return NextResponse.json({ ok: true });
  }

  const legalAccepted = record.identifier.split(":")[2] === "1";
  const telegramId = from.id.toString();
  const photoFileId = await getTelegramPhotoFileId(telegramId);

  await db.verificationToken.update({
    where: { token },
    data: {
      identifier: buildVerifiedTelegramBotLoginIdentifier(
        {
          id: telegramId,
          firstName: from.first_name ?? null,
          lastName: from.last_name ?? null,
          username: from.username ?? null,
          photoFileId,
        },
        legalAccepted,
      ),
    },
  });

  await sendTelegramMessage(chatId, "Готово. Вернитесь на сайт, вход завершится автоматически.", `${siteUrl}/login`);

  return NextResponse.json({ ok: true });
}
