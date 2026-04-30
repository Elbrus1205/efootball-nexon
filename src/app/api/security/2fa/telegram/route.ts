import { NextResponse } from "next/server";
import { buildSecurityContext } from "@/lib/auth/security";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createTelegramTwoFactorChallenge, verifyTwoFactorChallenge } from "@/lib/two-factor";

export async function POST(request: Request) {
  const session = await requireAuth();
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "send");
  const context = buildSecurityContext(request.headers);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      telegramId: true,
      telegram2faEnabled: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  if (!user.telegramId) {
    return NextResponse.json({ error: "Сначала привяжите Telegram к аккаунту." }, { status: 400 });
  }

  if (action === "send") {
    const purpose = user.telegram2faEnabled ? "DISABLE_2FA" : "ENABLE_2FA";
    const challengeToken = await createTelegramTwoFactorChallenge({
      userId: user.id,
      telegramId: user.telegramId,
      purpose,
      context,
    });

    return NextResponse.json({
      ok: true,
      challengeToken,
      mode: user.telegram2faEnabled ? "disable" : "enable",
    });
  }

  if (action === "verify") {
    const challengeToken = String(body?.challengeToken ?? "");
    const code = String(body?.code ?? "").trim();
    const purpose = user.telegram2faEnabled ? "DISABLE_2FA" : "ENABLE_2FA";

    if (!challengeToken || !code) {
      return NextResponse.json({ error: "Введите код из Telegram." }, { status: 400 });
    }

    const verified = await verifyTwoFactorChallenge({
      userId: user.id,
      token: challengeToken,
      code,
      purpose,
    });

    if (!verified) {
      return NextResponse.json({ error: "Код неверный или уже истёк." }, { status: 400 });
    }

    const nextEnabled = !user.telegram2faEnabled;

    await db.user.update({
      where: { id: user.id },
      data: {
        telegram2faEnabled: nextEnabled,
        telegram2faEnabledAt: nextEnabled ? new Date() : null,
      },
    });

    return NextResponse.json({
      ok: true,
      enabled: nextEnabled,
    });
  }

  return NextResponse.json({ error: "Неверное действие." }, { status: 400 });
}
