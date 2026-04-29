import { compare, hash } from "bcryptjs";
import { LoginAttemptStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { buildSecurityContext, createLoginHistory } from "@/lib/auth/security";
import { db } from "@/lib/db";
import { normalizeAuthIdentifier } from "@/lib/phone";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const identifier = String(body?.phone ?? body?.email ?? "").trim();
  const parsedIdentifier = normalizeAuthIdentifier(identifier);
  const rawPassword = String(body?.password ?? "");
  const trimmedPassword = rawPassword.trim();

  if (parsedIdentifier.type === "unknown" || !rawPassword) {
    return NextResponse.json({ error: "Введите номер телефона и пароль." }, { status: 400 });
  }

  const context = buildSecurityContext(request.headers);
  const where =
    parsedIdentifier.type === "email"
      ? {
          email: {
            equals: parsedIdentifier.value,
            mode: "insensitive" as const,
          },
        }
      : { phone: parsedIdentifier.value };

  const user = await db.user.findFirst({
    where,
    select: {
      id: true,
      email: true,
      phone: true,
      passwordHash: true,
      isBanned: true,
    },
  });

  if (!user?.passwordHash) {
    await createLoginHistory({
      userId: user?.id,
      identifier: parsedIdentifier.value,
      status: LoginAttemptStatus.FAILED,
      context,
    });

    return NextResponse.json({ error: "Неверный номер телефона/email или пароль." }, { status: 401 });
  }

  if (user.isBanned) {
    await createLoginHistory({
      userId: user.id,
      identifier: parsedIdentifier.value,
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
      identifier: parsedIdentifier.value,
      status: LoginAttemptStatus.FAILED,
      context,
    });

    return NextResponse.json({ error: "Неверный номер телефона/email или пароль." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    requiresTwoFactor: false,
  });
}
