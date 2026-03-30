import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
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
      passwordHash: true,
    },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Для этого аккаунта пароль пока не задан." }, { status: 400 });
  }

  const isValid = await compare(body.password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Пароль для подтверждения указан неверно." }, { status: 400 });
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

  return NextResponse.json({ ok: true, email: normalizedEmail });
}
