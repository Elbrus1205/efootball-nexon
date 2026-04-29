import { VerificationCodePurpose } from "@prisma/client";
import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { hashVerificationCode } from "@/lib/email";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { securityAccountDeletionSchema } from "@/lib/validators";

export async function DELETE(request: Request) {
  const session = await requireAuth();
  const body = securityAccountDeletionSchema.parse(await request.json());

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

  const isValidPassword = await compare(body.password, user.passwordHash);
  if (!isValidPassword) {
    return NextResponse.json({ error: "Пароль указан неверно." }, { status: 400 });
  }

  let emailRecord: { id: string } | null = null;
  if (user.email) {
    if (!body.emailCode || body.emailCode.trim().length !== 6) {
      return NextResponse.json({ error: "Введите код из письма." }, { status: 400 });
    }

    const emailCodeHash = hashVerificationCode(body.emailCode);
    emailRecord = await db.emailVerificationCode.findFirst({
      where: {
        userId: user.id,
        email: user.email,
        purpose: VerificationCodePurpose.ACCOUNT_DELETION,
        codeHash: emailCodeHash,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!emailRecord) {
      return NextResponse.json({ error: "Код из письма неверный или уже истёк." }, { status: 400 });
    }
  }

  await db.$transaction(async (tx) => {
    if (emailRecord) {
      await tx.emailVerificationCode.update({
        where: { id: emailRecord.id },
        data: {
          usedAt: new Date(),
        },
      });
    }

    await tx.user.delete({
      where: { id: user.id },
    });
  });

  return NextResponse.json({ ok: true });
}
