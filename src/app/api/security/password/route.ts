import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { revokeSecuritySessions } from "@/lib/auth/security";
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

  const nextPasswordHash = await hash(body.newPassword, 10);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: nextPasswordHash,
    },
  });

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
