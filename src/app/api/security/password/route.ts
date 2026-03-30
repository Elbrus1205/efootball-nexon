import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { revokeSecuritySessions } from "@/lib/auth/security";
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

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Для этого аккаунта пароль пока не задан." }, { status: 400 });
  }

  const isValid = await compare(body.currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Текущий пароль указан неверно." }, { status: 400 });
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
        otherSessions.map((item: { authSessionId: string }) => item.authSessionId),
      );
    }
  }

  return NextResponse.json({ ok: true });
}
