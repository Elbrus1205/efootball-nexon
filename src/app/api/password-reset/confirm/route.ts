import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/request-rate-limit";

export async function POST(request: Request) {
  const { token, password } = (await request.json()) as { token: string; password: string };

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Некорректная ссылка для сброса пароля." }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Пароль должен содержать минимум 8 символов." }, { status: 400 });
  }

  const limited = enforceRateLimit(request, "password-reset-confirm", { limit: 10, windowMs: 15 * 60 * 1_000 }, token);
  if (limited) return limited;

  const record = await db.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date() || record.usedAt) {
    return NextResponse.json({ error: "Ссылка недействительна или срок её действия истёк. Запросите сброс пароля заново." }, { status: 400 });
  }

  const passwordHash = await hash(password, 10);
  const user = record.userId
    ? await db.user.findUnique({ where: { id: record.userId } })
    : await db.user.findUnique({ where: { email: record.email } });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await db.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
