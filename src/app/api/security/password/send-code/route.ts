import { VerificationCodePurpose } from "@prisma/client";
import { NextResponse } from "next/server";
import { generateVerificationCode, hashVerificationCode, sendPasswordChangeCode } from "@/lib/email";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

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
    return NextResponse.json({ error: "Сначала привяжите почту к аккаунту." }, { status: 400 });
  }

  const code = generateVerificationCode();

  await db.emailVerificationCode.updateMany({
    where: {
      userId: user.id,
      email: user.email,
      purpose: VerificationCodePurpose.PASSWORD_CHANGE,
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
      purpose: VerificationCodePurpose.PASSWORD_CHANGE,
      codeHash: hashVerificationCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  try {
    await sendPasswordChangeCode({
      email: user.email,
      code,
    });
  } catch {
    return NextResponse.json({ error: "Не удалось отправить код на почту." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
