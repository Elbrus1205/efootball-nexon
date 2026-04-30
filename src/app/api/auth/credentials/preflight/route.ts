import { compare, hash } from "bcryptjs";
import { LoginAttemptStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { buildSecurityContext, createLoginHistory } from "@/lib/auth/security";
import { db } from "@/lib/db";
import { createTelegramTwoFactorChallenge } from "@/lib/two-factor";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const rawPassword = String(body?.password ?? "");
  const trimmedPassword = rawPassword.trim();

  if (!email || !rawPassword) {
    return NextResponse.json({ error: "Введите email и пароль." }, { status: 400 });
  }

  const context = buildSecurityContext(request.headers);
  const user = await db.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      isBanned: true,
      telegram2faEnabled: true,
      telegramId: true,
    },
  });

  if (!user?.passwordHash) {
    await createLoginHistory({
      userId: user?.id,
      email,
      status: LoginAttemptStatus.FAILED,
      context,
    });

    return NextResponse.json({ error: "Неверный email или пароль." }, { status: 401 });
  }

  if (user.isBanned) {
    await createLoginHistory({
      userId: user.id,
      email,
      status: LoginAttemptStatus.FAILED,
      context,
    });

    return NextResponse.json({ error: "Аккаунт заблокирован навсегда." }, { status: 403 });
  }

  const passwordCandidates = Array.from(new Set([rawPassword, trimmedPassword].filter(Boolean)));
  let isValid = false;

  if (user.passwordHash.startsWith("$2")) {
    for (const candidate of passwordCandidates) {
      if (await compare(candidate, user.passwordHash)) {
        isValid = true;
        break;
      }
    }
  } else {
    for (const candidate of passwordCandidates) {
      if (candidate === user.passwordHash) {
        isValid = true;
        await db.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await hash(candidate, 10),
          },
        });
        break;
      }
    }
  }

  if (!isValid) {
    await createLoginHistory({
      userId: user.id,
      email,
      status: LoginAttemptStatus.FAILED,
      context,
    });

    return NextResponse.json({ error: "Неверный email или пароль." }, { status: 401 });
  }

  if (user.telegram2faEnabled) {
    if (!user.telegramId) {
      return NextResponse.json({ error: "Для 2FA не привязан Telegram аккаунт." }, { status: 400 });
    }

    const challengeToken = await createTelegramTwoFactorChallenge({
      userId: user.id,
      telegramId: user.telegramId,
      purpose: "LOGIN",
      context,
    });

    return NextResponse.json({
      ok: true,
      requiresTwoFactor: true,
      challengeToken,
    });
  }

  return NextResponse.json({
    ok: true,
    requiresTwoFactor: false,
  });
}
