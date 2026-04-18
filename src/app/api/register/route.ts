import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { getLegalAcceptanceData, LEGAL_ACCEPTANCE_REQUIRED_MESSAGE } from "@/lib/legal-acceptance";
import { profileSchema, registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsedBody = registerSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    const fieldErrors = parsedBody.error.flatten().fieldErrors;
    const error =
      fieldErrors.legalAccepted?.[0] ??
      fieldErrors.email?.[0] ??
      fieldErrors.password?.[0] ??
      fieldErrors.name?.[0] ??
      LEGAL_ACCEPTANCE_REQUIRED_MESSAGE;

    return NextResponse.json({ error }, { status: 400 });
  }

  const body = parsedBody.data;
  const normalizedEmail = body.email.trim().toLowerCase();
  const existing = await db.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(body.password, 10);

  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: body.name,
      ...getLegalAcceptanceData(request.headers),
    },
  });

  return NextResponse.json({ userId: user.id });
}

export async function PATCH(request: Request) {
  const session = await requireAuth();
  const body = profileSchema.parse(await request.json());
  const existingUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      nameUpdatedAt: true,
    },
  });

  if (!existingUser) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  const normalizedName = body.name.trim();
  const nameChanged = normalizedName !== (existingUser.name ?? "");

  if (nameChanged && existingUser.nameUpdatedAt) {
    const nextAvailableAt = new Date(existingUser.nameUpdatedAt);
    nextAvailableAt.setMonth(nextAvailableAt.getMonth() + 6);

    if (nextAvailableAt > new Date()) {
      return NextResponse.json(
        {
          error: `Имя можно менять только раз в 6 месяцев. Следующая смена будет доступна после ${new Intl.DateTimeFormat("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(nextAvailableAt)}.`,
        },
        { status: 400 },
      );
    }
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data: {
      name: normalizedName,
      ...(nameChanged ? { nameUpdatedAt: new Date() } : {}),
      favoriteTeam: body.favoriteTeam || null,
      bio: body.bio || null,
      bannerImage: body.bannerImage || null,
      image: body.image || null,
    },
  });

  return NextResponse.json({ user });
}
