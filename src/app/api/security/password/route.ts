import { VerificationCodePurpose } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { revokeSecuritySessions } from "@/lib/auth/security";
import { hashVerificationCode } from "@/lib/email";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { securityPasswordSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  const session = await requireAuth();
  const body = securityPasswordSchema.parse(await request.json());

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  if (user.passwordHash) {
    if (!body.currentPassword?.trim()) {
      return NextResponse.json({ error: "Введите текущий пароль." }, { status: 400 });
    }

    const isValid = await compare(body.currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Текущий пароль указан неверно." }, { status: 400 });
    }
  }

  const userWithEmail = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
    },
  });

  if (!userWithEmail?.email) {
    return NextResponse.json({ error: "Сначала привяжите почту к аккаунту." }, { status: 400 });
  }

  const codeHash = hashVerificationCode(body.code);
  const record = await db.emailVerificationCode.findFirst({
    where: {
      userId: user.id,
      email: userWithEmail.email,
      purpose: VerificationCodePurpose.PASSWORD_CHANGE,
      codeHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!record) {
    return NextResponse.json({ error: "Код подтверждения неверный или уже истёк." }, { status: 400 });
  }

  const nextPasswordHash = await hash(body.newPassword, 10);

  await db.$transaction([
    db.emailVerificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: nextPasswordHash,
      },
    }),
  ]);

  if (session.user.authSessionId) {
    const otherSessions = await db.securitySession.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        authSessionId: {
          not: session.user.authSessionId,
        },
      },
      select: {
        authSessionId: true,
      },
    });

    if (otherSessions.length > 0) {
      await revokeSecuritySessions(
        user.id,
        otherSessions.map((item) => item.authSessionId),
      );
    }
  }

  return NextResponse.json({ ok: true, hasPassword: true });
}
