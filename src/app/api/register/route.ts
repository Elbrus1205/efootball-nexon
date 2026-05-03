import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { ProfileStatusApprovalStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { getLegalAcceptanceData, LEGAL_ACCEPTANCE_REQUIRED_MESSAGE } from "@/lib/legal-acceptance";
import { generateUniquePublicPlayerId } from "@/lib/public-player-id";
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
      publicId: await generateUniquePublicPlayerId(),
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
  const parsedBody = profileSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    const fieldErrors = parsedBody.error.flatten().fieldErrors;
    const error =
      fieldErrors.name?.[0] ??
      fieldErrors.favoriteTeam?.[0] ??
      fieldErrors.bio?.[0] ??
      fieldErrors.selectedStatusIds?.[0] ??
      fieldErrors.bannerImage?.[0] ??
      fieldErrors.image?.[0] ??
      "Не удалось проверить данные профиля.";

    return NextResponse.json({ error }, { status: 400 });
  }

  const body = parsedBody.data;
  const selectedStatusIds = Array.from(new Set(body.selectedStatusIds ?? []));
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

  const ownedStatuses = selectedStatusIds.length
    ? await db.userProfileStatus.findMany({
        where: {
          id: { in: selectedStatusIds },
          userId: session.user.id,
          approvalStatus: ProfileStatusApprovalStatus.APPROVED,
        },
        select: { id: true },
      })
    : [];

  if (ownedStatuses.length !== selectedStatusIds.length) {
    return NextResponse.json({ error: "Можно выбрать только свои подтверждённые статусы." }, { status: 400 });
  }

  const user = await db.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
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

    await tx.userProfileStatus.updateMany({
      where: { userId: session.user.id },
      data: { selectedOrder: null },
    });

    await Promise.all(
      selectedStatusIds.map((statusId, index) =>
        tx.userProfileStatus.update({
          where: { id: statusId },
          data: { selectedOrder: index + 1 },
        }),
      ),
    );

    return updatedUser;
  });

  return NextResponse.json({ user });
}
