import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { parseTelegramOidcResultPayloadIdentifier } from "@/lib/telegram-oidc";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "Не передан токен Telegram." }, { status: 400 });
    }

    const record = await db.verificationToken.findUnique({ where: { token } });
    if (!record || record.expires < new Date()) {
      if (record) {
        await db.verificationToken.delete({ where: { token } }).catch(() => null);
      }

      return NextResponse.json({ error: "Сессия привязки Telegram истекла. Запустите привязку ещё раз." }, { status: 400 });
    }

    const payload = parseTelegramOidcResultPayloadIdentifier(record.identifier);
    if (!payload || payload.mode !== "connect") {
      await db.verificationToken.delete({ where: { token } }).catch(() => null);
      return NextResponse.json({ error: "Неверные данные привязки Telegram." }, { status: 400 });
    }

    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { telegramId: true },
    });

    if (!currentUser) {
      await db.verificationToken.delete({ where: { token } }).catch(() => null);
      return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
    }

    if (currentUser.telegramId && currentUser.telegramId !== payload.profile.telegramId) {
      await db.verificationToken.delete({ where: { token } }).catch(() => null);
      return NextResponse.json(
        { error: "Изменить привязку Telegram можно только через администратора." },
        { status: 403 },
      );
    }

    const existingOwner = await db.user.findUnique({
      where: { telegramId: payload.profile.telegramId },
      select: { id: true },
    });

    if (existingOwner && existingOwner.id !== session.user.id) {
      await db.verificationToken.delete({ where: { token } }).catch(() => null);
      return NextResponse.json({ error: "Этот Telegram уже привязан к другому аккаунту." }, { status: 409 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        telegramId: payload.profile.telegramId,
        telegramUsername: payload.profile.username ?? null,
        image: payload.profile.picture || undefined,
      },
    });

    await db.verificationToken.delete({ where: { token } }).catch(() => null);

    return NextResponse.json({
      ok: true,
      message: payload.profile.username
        ? `Telegram @${payload.profile.username} успешно привязан.`
        : "Telegram успешно привязан.",
    });
  } catch (error) {
    console.error("telegram oidc connection finalize error", error);
    return NextResponse.json({ error: "Не удалось привязать Telegram." }, { status: 500 });
  }
}
