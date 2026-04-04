import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { verifyTelegramAuth, type TelegramPayload } from "@/lib/auth/telegram";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = (await request.json()) as TelegramPayload;
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "Telegram-бот не настроен." }, { status: 500 });
    }

    if (!payload?.id || !payload?.hash || !payload?.auth_date) {
      return NextResponse.json({ error: "Не удалось получить данные Telegram." }, { status: 400 });
    }

    const verified = verifyTelegramAuth(payload, token);
    if (!verified) {
      return NextResponse.json({ error: "Проверка Telegram не прошла." }, { status: 400 });
    }

    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        telegramId: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
    }

    if (currentUser.telegramId && currentUser.telegramId !== payload.id) {
      return NextResponse.json(
        { error: "Изменить привязку Telegram можно только через администратора." },
        { status: 403 },
      );
    }

    const existingOwner = await db.user.findUnique({
      where: { telegramId: payload.id },
      select: { id: true },
    });

    if (existingOwner && existingOwner.id !== session.user.id) {
      return NextResponse.json({ error: "Этот Telegram уже привязан к другому аккаунту." }, { status: 409 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        telegramId: payload.id,
        telegramUsername: payload.username ?? null,
        image: payload.photo_url || undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      message: payload.username
        ? `Telegram @${payload.username} успешно привязан.`
        : "Telegram успешно привязан.",
    });
  } catch (error) {
    console.error("telegram connection error", error);
    return NextResponse.json({ error: "Не удалось привязать Telegram." }, { status: 500 });
  }
}
