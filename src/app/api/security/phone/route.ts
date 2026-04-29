import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/phone";

export async function PATCH(request: Request) {
  const session = await requireAuth();
  const body = (await request.json().catch(() => null)) as { phone?: string } | null;
  const normalizedPhone = normalizePhoneNumber(String(body?.phone ?? ""));

  if (!normalizedPhone) {
    return NextResponse.json({ error: "Введите корректный номер телефона." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, phone: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  const existingUser = await db.user.findFirst({
    where: {
      phone: normalizedPhone,
      NOT: {
        id: user.id,
      },
    },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "Этот номер телефона уже используется." }, { status: 409 });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      phone: normalizedPhone,
    },
  });

  return NextResponse.json({ ok: true, phone: normalizedPhone });
}
