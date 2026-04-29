import { VerificationCodePurpose } from "@prisma/client";
import { NextResponse } from "next/server";
import { sendAccountDeletionCode, generateVerificationCode, hashVerificationCode } from "@/lib/email";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST() {
  const session = await requireAuth();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: "Сначала задайте пароль для аккаунта." }, { status: 400 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "Сначала привяжите email к аккаунту, чтобы подтвердить удаление." }, { status: 400 });
  }

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

  return NextResponse.json({
    ok: true,
    emailSent: true,
  });
}
