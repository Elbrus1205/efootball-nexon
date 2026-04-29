import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLegalAcceptanceData, LEGAL_ACCEPTANCE_REQUIRED_MESSAGE } from "@/lib/legal-acceptance";
import { normalizePhoneNumber } from "@/lib/phone";
import { generateUniquePublicPlayerId } from "@/lib/public-player-id";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        phone?: string;
        email?: string;
        password?: string;
        name?: string;
        legalAccepted?: boolean;
      }
    | null;

  const phoneInput = String(body?.phone ?? "");
  const normalizedPhone = normalizePhoneNumber(phoneInput);
  const normalizedEmail = String(body?.email ?? "").trim().toLowerCase() || null;
  const password = String(body?.password ?? "");
  const name = String(body?.name ?? "").trim();
  const legalAccepted = Boolean(body?.legalAccepted);

  if (!legalAccepted) {
    return NextResponse.json({ error: LEGAL_ACCEPTANCE_REQUIRED_MESSAGE }, { status: 400 });
  }

  if (!normalizedPhone) {
    return NextResponse.json({ error: "Введите корректный номер телефона." }, { status: 400 });
  }

  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: "Введите корректный email." }, { status: 400 });
  }

  if (password.trim().length < 8) {
    return NextResponse.json({ error: "Пароль должен быть не короче 8 символов." }, { status: 400 });
  }

  if (name.length < 2) {
    return NextResponse.json({ error: "Имя должно быть не короче 2 символов." }, { status: 400 });
  }

  const existingPhone = await db.user.findUnique({
    where: { phone: normalizedPhone },
    select: { id: true },
  });

  if (existingPhone) {
    return NextResponse.json({ error: "Этот номер телефона уже используется." }, { status: 409 });
  }

  if (normalizedEmail) {
    const existingEmail = await db.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json({ error: "Этот email уже используется." }, { status: 409 });
    }
  }

  const passwordHash = await hash(password, 10);

  const user = await db.user.create({
    data: {
      publicId: await generateUniquePublicPlayerId(),
      phone: normalizedPhone,
      email: normalizedEmail,
      passwordHash,
      name,
      ...getLegalAcceptanceData(request.headers),
    },
  });

  return NextResponse.json({
    ok: true,
    userId: user.id,
  });
}
