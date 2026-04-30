import { VerificationCodePurpose } from "@prisma/client";
import { NextResponse } from "next/server";
import { buildSecurityContext } from "@/lib/auth/security";
import { sendAccountDeletionCode, generateVerificationCode, hashVerificationCode } from "@/lib/email";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createTelegramTwoFactorChallenge } from "@/lib/two-factor";

export async function POST(request: Request) {
  const session = await requireAuth();
  const context = buildSecurityContext(request.headers);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      telegramId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: "Сначала задайте пароль для аккаунта." }, { status: 400 });
  }

  if (!user.email && !user.telegramId) {
    return NextResponse.json({ error: "Нет привязанной почты или Telegram для отправки кодов." }, { status: 400 });
  }

  if (user.email) {
    const emailCode = generateVerificationCode();

    await db.emailVerificationCode.updateMany({
      where: {
        userId: user.id,
        email: user.email,
        purpose: VerificationCodePurpose.ACCOUNT_DELETION,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await db.emailVerificationCode.create({
      data: {
        userId: user.id,
        email: user.email,
        purpose: VerificationCodePurpose.ACCOUNT_DELETION,
        codeHash: hashVerificationCode(emailCode),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    try {
      await sendAccountDeletionCode({
        email: user.email,
        code: emailCode,
      });
    } catch {
      return NextResponse.json({ error: "Не удалось отправить код на почту." }, { status: 500 });
    }
  }

  if (!user.telegramId) {
    return NextResponse.json({
      ok: true,
      emailSent: Boolean(user.email),
      telegramSent: false,
      telegramChallengeToken: "",
    });
  }

  try {
    const telegramChallengeToken = await createTelegramTwoFactorChallenge({
      userId: user.id,
      telegramId: user.telegramId,
      purpose: "ACCOUNT_DELETION",
      context,
    });

    return NextResponse.json({
      ok: true,
      emailSent: Boolean(user.email),
      telegramSent: true,
      telegramChallengeToken,
    });
  } catch {
    return NextResponse.json(
      { error: user.email ? "Код на почту отправлен, но Telegram-код не отправился." : "Не удалось отправить Telegram-код." },
      { status: 500 },
    );
  }
}
