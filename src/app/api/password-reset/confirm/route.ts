import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const { token, password } = (await request.json()) as { token: string; password: string };
  const record = await db.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date() || record.usedAt) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
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
