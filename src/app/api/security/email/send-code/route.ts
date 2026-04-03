import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { generateVerificationCode, hashVerificationCode, sendEmailVerificationCode } from "@/lib/email";

export async function POST() {
  const session = await requireAuth();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user?.email) {
    return NextResponse.json({ error: "У аккаунта пока нет email для подтверждения." }, { status: 400 });
  }

  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(code);

  await db.emailVerificationCode.updateMany({
    where: {
      userId: user.id,
      email: user.email,
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
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  try {
    await sendEmailVerificationCode({
      email: user.email,
      code,
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось отправить код. Проверьте настройки email-провайдера." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
