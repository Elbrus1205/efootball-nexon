import { VerificationCodePurpose } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { generateVerificationCode, hashVerificationCode, sendEmailVerificationCode } from "@/lib/email";
import { securityEmailSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  const session = await requireAuth();
  const body = securityEmailSchema.parse(await request.json());
  const normalizedEmail = body.email.trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  const existingUser = await db.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
      NOT: {
        id: user.id,
      },
    },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "Этот email уже используется." }, { status: 409 });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      email: normalizedEmail,
      emailVerified: null,
    },
  });

  const code = generateVerificationCode();

  await db.emailVerificationCode.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  await db.emailVerificationCode.create({
    data: {
      userId: user.id,
      email: normalizedEmail,
      purpose: VerificationCodePurpose.EMAIL_CONFIRMATION,
      codeHash: hashVerificationCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  try {
    await sendEmailVerificationCode({
      email: normalizedEmail,
      code,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Email обновлён, но код не отправился. Проверьте настройки email-провайдера.",
        email: normalizedEmail,
        emailUpdated: true,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, email: normalizedEmail, verificationSent: true });
}
