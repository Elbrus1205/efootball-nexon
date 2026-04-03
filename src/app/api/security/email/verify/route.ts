import { VerificationCodePurpose } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hashVerificationCode } from "@/lib/email";
import { emailVerificationCodeSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await requireAuth();
  const body = emailVerificationCodeSchema.parse(await request.json());

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

  const codeHash = hashVerificationCode(body.code);
  const record = await db.emailVerificationCode.findFirst({
    where: {
      userId: user.id,
      email: user.email,
      purpose: VerificationCodePurpose.EMAIL_CONFIRMATION,
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
    return NextResponse.json({ error: "Код неверный или уже истёк." }, { status: 400 });
  }

  await db.emailVerificationCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
