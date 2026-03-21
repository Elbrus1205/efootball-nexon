import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email: string };
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok: true });

  const token = crypto.randomBytes(24).toString("hex");
  await db.passwordResetToken.create({
    data: {
      token,
      email,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  return NextResponse.json({
    ok: true,
    resetUrl: `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`,
  });
}
