import crypto from "crypto";
import { NextResponse } from "next/server";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { sendPasswordResetLink } from "@/lib/email";
import { enforceRateLimit } from "@/lib/request-rate-limit";

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email: string };
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return NextResponse.json({ error: "Введите email." }, { status: 400 });
  }

  const limited = enforceRateLimit(request, "password-reset", { limit: 5, windowMs: 15 * 60 * 1_000 }, normalizedEmail);
  if (limited) return limited;

  const user = await db.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });

  if (!user) return NextResponse.json({ ok: true });

  const token = crypto.randomBytes(24).toString("hex");
  const resetUrl = `${getConfiguredSiteBaseUrl()}/reset-password?token=${token}`;

  const resetToken = await db.passwordResetToken.create({
    data: {
      token,
      email: normalizedEmail,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  try {
    await sendPasswordResetLink({
      email: normalizedEmail,
      resetUrl,
    });
  } catch {
    await db.passwordResetToken.delete({
      where: { id: resetToken.id },
    }).catch(() => null);

    return NextResponse.json(
      { error: "Не удалось отправить письмо. Проверьте настройки email-провайдера." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
