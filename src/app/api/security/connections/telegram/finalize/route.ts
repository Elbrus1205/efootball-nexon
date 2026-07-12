import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { describeTelegramOidcError, verifyAndConsumeTelegramIdToken } from "@/lib/telegram-oidc-server";
import { maybeCacheTelegramAvatar } from "@/lib/media-processing";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = (await request.json().catch(() => ({}))) as { idToken?: string };
    const idToken = body.idToken?.trim();

    if (!idToken) {
      return NextResponse.json({ error: "Не передан ID token Telegram." }, { status: 400 });
    }

    const profile = await verifyAndConsumeTelegramIdToken(idToken);

    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { telegramId: true, image: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
    }

    if (currentUser.telegramId && currentUser.telegramId !== profile.telegramId) {
      return NextResponse.json(
        { error: "Изменить привязку Telegram можно только через администратора." },
        { status: 403 },
      );
    }

    const existingOwner = await db.user.findUnique({
      where: { telegramId: profile.telegramId },
      select: { id: true },
    });

    if (existingOwner && existingOwner.id !== session.user.id) {
      return NextResponse.json({ error: "Этот Telegram уже привязан к другому аккаунту." }, { status: 409 });
    }

    const cachedAvatar = await maybeCacheTelegramAvatar({
      telegramImage: profile.picture,
      currentImage: currentUser.image,
      identity: profile.telegramId,
    });

    await db.user.update({
      where: { id: session.user.id },
      data: {
        telegramId: profile.telegramId,
        telegramUsername: profile.username ?? null,
        image: cachedAvatar,
      },
    });

    return NextResponse.json({
      ok: true,
      message: profile.username
        ? `Telegram @${profile.username} успешно привязан.`
        : "Telegram успешно привязан.",
    });
  } catch (error) {
    const described = describeTelegramOidcError(error);
    console.error("telegram oidc connection finalize error", {
      error: described.message,
      cause: described.cause,
    });

    if (described.message === "id-token-already-used") {
      return NextResponse.json({ error: "Этот Telegram токен уже был использован. Запустите вход ещё раз." }, { status: 400 });
    }

    return NextResponse.json({ error: "Не удалось привязать Telegram." }, { status: 500 });
  }
}
