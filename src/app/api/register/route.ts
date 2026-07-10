import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getActiveProfileStatusWhere } from "@/lib/profile-status-query";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { generateVerificationCode, hashVerificationCode, sendEmailVerificationCode, sendGuardianConsentCode } from "@/lib/email";
import { ADULT_AGE, getRegistrationAge, getRegistrationConsentData, LEGAL_ACCEPTANCE_REQUIRED_MESSAGE } from "@/lib/legal-acceptance";
import { generateUniquePublicPlayerId } from "@/lib/public-player-id";
import { resolveRequestTimeZone } from "@/lib/time-zone";
import { DISPLAY_NAME_TAKEN_MESSAGE, isDisplayNameTaken, isDisplayNameUniqueError, normalizeDisplayName } from "@/lib/user-names";
import { profileSchema, registerSchema } from "@/lib/validators";

const REGISTER_CODE_TTL_MS = 10 * 60 * 1000;

function getRegisterCodeIdentifier(email: string) {
  return `register-email:${email}`;
}

function getGuardianCodeIdentifier(email: string, guardianEmail: string) {
  return `register-guardian:${email}:${guardianEmail}`;
}

export async function POST(request: Request) {
  const rawBody = await request.json();
  const parsedBody = registerSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    const fieldErrors = parsedBody.error.flatten().fieldErrors;
    const error =
      fieldErrors.termsAccepted?.[0] ??
      fieldErrors.personalDataConsent?.[0] ??
      fieldErrors.publicDataConsent?.[0] ??
      fieldErrors.dateOfBirth?.[0] ??
      fieldErrors.guardianFullName?.[0] ??
      fieldErrors.guardianEmail?.[0] ??
      fieldErrors.email?.[0] ??
      fieldErrors.password?.[0] ??
      fieldErrors.name?.[0] ??
      LEGAL_ACCEPTANCE_REQUIRED_MESSAGE;

    return NextResponse.json({ error }, { status: 400 });
  }

  const body = parsedBody.data;
  const normalizedEmail = body.email.trim().toLowerCase();
  const normalizedName = normalizeDisplayName(body.name);
  const emailCode = String((rawBody as { emailCode?: unknown }).emailCode ?? "").trim();
  const guardianCode = String((rawBody as { guardianCode?: unknown }).guardianCode ?? "").trim();
  const registrationAge = getRegistrationAge(body.dateOfBirth)!;
  const isMinor = registrationAge.age < ADULT_AGE;
  const guardianFullName = isMinor ? body.guardianFullName?.trim() ?? "" : "";
  const guardianEmail = isMinor ? body.guardianEmail?.trim().toLowerCase() ?? "" : "";
  const requestTimeZone = resolveRequestTimeZone(request.headers);

  if (isMinor && guardianEmail === normalizedEmail) {
    return NextResponse.json({ error: "Email законного представителя должен отличаться от email пользователя." }, { status: 400 });
  }
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

  if (await isDisplayNameTaken(normalizedName)) {
    return NextResponse.json({ error: DISPLAY_NAME_TAKEN_MESSAGE }, { status: 409 });
  }

  const identifier = getRegisterCodeIdentifier(normalizedEmail);
  const guardianIdentifier = isMinor ? getGuardianCodeIdentifier(normalizedEmail, guardianEmail) : null;

  if (!emailCode) {
    const code = generateVerificationCode();
    const token = hashVerificationCode(`${normalizedEmail}:${code}`);
    const guardianVerificationCode = isMinor ? generateVerificationCode() : null;
    const guardianToken = guardianIdentifier && guardianVerificationCode ? hashVerificationCode(`${guardianIdentifier}:${guardianVerificationCode}`) : null;

    await db.$transaction([
      db.verificationToken.deleteMany({ where: { identifier } }),
      ...(guardianIdentifier ? [db.verificationToken.deleteMany({ where: { identifier: guardianIdentifier } })] : []),
      db.verificationToken.create({
        data: {
          identifier,
          token,
          expires: new Date(Date.now() + REGISTER_CODE_TTL_MS),
        },
      }),
      ...(guardianIdentifier && guardianToken
        ? [
            db.verificationToken.create({
              data: {
                identifier: guardianIdentifier,
                token: guardianToken,
                expires: new Date(Date.now() + REGISTER_CODE_TTL_MS),
              },
            }),
          ]
        : []),
    ]);

    try {
      await Promise.all([
        sendEmailVerificationCode({ email: normalizedEmail, code }),
        ...(guardianVerificationCode ? [sendGuardianConsentCode({ email: guardianEmail, code: guardianVerificationCode })] : []),
      ]);
    } catch {
      await db.verificationToken.deleteMany({
        where: { identifier: { in: [identifier, ...(guardianIdentifier ? [guardianIdentifier] : [])] } },
      });

      return NextResponse.json(
        { error: "Не удалось отправить код пользователю или законному представителю. Проверьте email и повторите попытку." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, verificationRequired: true, guardianVerificationRequired: isMinor });
  }

  if (!/^\d{6}$/.test(emailCode)) {
    return NextResponse.json({ error: "Введите 6-значный код из письма." }, { status: 400 });
  }

  const token = hashVerificationCode(`${normalizedEmail}:${emailCode}`);
  const verification = await db.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier,
        token,
      },
    },
  });

  if (!verification || verification.expires < new Date()) {
    return NextResponse.json({ error: "Код неверный или уже истёк." }, { status: 400 });
  }

  let guardianVerification: { identifier: string; token: string; expires: Date } | null = null;
  if (isMinor && guardianIdentifier) {
    if (!/^\d{6}$/.test(guardianCode)) {
      return NextResponse.json({ error: "Введите 6-значный код, отправленный законному представителю." }, { status: 400 });
    }

    const guardianToken = hashVerificationCode(`${guardianIdentifier}:${guardianCode}`);
    guardianVerification = await db.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: guardianIdentifier,
          token: guardianToken,
        },
      },
    });

    if (!guardianVerification || guardianVerification.expires < new Date()) {
      return NextResponse.json({ error: "Код законного представителя неверный или уже истёк." }, { status: 400 });
    }
  }

  const passwordHash = await hash(body.password, 10);

  const user = await db
    .$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          publicId: await generateUniquePublicPlayerId(),
          email: normalizedEmail,
          emailVerified: new Date(),
          passwordHash,
          name: normalizedName,
          timeZone: requestTimeZone,
          timeZoneUpdatedAt: requestTimeZone ? new Date() : null,
          ...getRegistrationConsentData(request.headers, {
            dateOfBirth: registrationAge.dateOfBirth,
            guardianFullName,
            guardianEmail,
          }),
        },
      });

      await tx.verificationToken.deleteMany({
        where: { identifier: { in: [identifier, ...(guardianIdentifier ? [guardianIdentifier] : [])] } },
      });

      return created;
    })
    .catch((error) => {
      if (isDisplayNameUniqueError(error)) return null;
      throw error;
    });

  if (!user) {
    return NextResponse.json({ error: DISPLAY_NAME_TAKEN_MESSAGE }, { status: 409 });
  }

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

  const normalizedName = normalizeDisplayName(body.name);
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
          ...getActiveProfileStatusWhere(),
          id: { in: selectedStatusIds },
          userId: session.user.id,
        },
        select: { id: true },
      })
    : [];

  if (ownedStatuses.length !== selectedStatusIds.length) {
    return NextResponse.json({ error: "Можно выбрать только свои подтверждённые статусы." }, { status: 400 });
  }

  if (nameChanged && (await isDisplayNameTaken(normalizedName, session.user.id))) {
    return NextResponse.json({ error: DISPLAY_NAME_TAKEN_MESSAGE }, { status: 409 });
  }

  const user = await db
    .$transaction(async (tx) => {
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
    })
    .catch((error) => {
      if (isDisplayNameUniqueError(error)) return null;
      throw error;
    });

  if (!user) {
    return NextResponse.json({ error: DISPLAY_NAME_TAKEN_MESSAGE }, { status: 409 });
  }

  return NextResponse.json({ user });
}
