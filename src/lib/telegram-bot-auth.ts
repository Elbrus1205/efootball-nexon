import { LoginAttemptStatus, UserRole, type User } from "@prisma/client";
import { generateFallbackName } from "@/lib/player-name";
import {
  buildVerifiedTelegramBotLoginIdentifier,
  parseTelegramBotLoginIdentifier,
  type TelegramBotLoginProfile,
} from "@/lib/telegram-bot-login";

const TELEGRAM_ADMIN_ID = "6595067194";

type VerificationTokenRecord = {
  token: string;
  identifier: string;
  expires: Date;
};

type UserRecord = Pick<
  User,
  "id" | "email" | "image" | "isBanned" | "name" | "role" | "telegramId" | "telegramUsername"
> & {
  legalAcceptedAt?: Date | null;
};

type LoginContext = {
  device: string;
  platform: string | null;
  location: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

type TelegramBotAuthDb = {
  verificationToken: {
    findUnique(args: { where: { token: string } }): Promise<VerificationTokenRecord | null>;
    update(args: { where: { token: string }; data: { identifier: string } }): Promise<unknown>;
    delete(args: { where: { token: string } }): Promise<unknown>;
  };
  user: {
    findUnique(args: { where: { telegramId?: string; id?: string } }): Promise<UserRecord | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<UserRecord>;
    create(args: { data: Record<string, unknown> }): Promise<UserRecord>;
  };
};

type FinalizeTelegramBotLoginDeps = {
  db: TelegramBotAuthDb;
  createLoginHistory(args: {
    userId?: string | null;
    email?: string | null;
    status: LoginAttemptStatus;
    context: LoginContext;
  }): Promise<void>;
  createSecuritySession(args: { userId: string; context: LoginContext }): Promise<string>;
  generateUniquePublicPlayerId(): Promise<string>;
  getLegalAcceptanceData(): Record<string, unknown>;
};

type HandleTelegramBotStartDeps = {
  db: TelegramBotAuthDb;
  getTelegramPhotoFileId(telegramId: string): Promise<string | null>;
  sendTelegramMessage(chatId: string, text: string, siteUrl: string): Promise<void>;
};

type TelegramStartUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
};

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === "P2002"
  );
}

function getTelegramRole(telegramId: string) {
  return telegramId === TELEGRAM_ADMIN_ID ? UserRole.FOUNDER : UserRole.PLAYER;
}

function getExistingRoleUpdate(telegramId: string) {
  return telegramId === TELEGRAM_ADMIN_ID ? UserRole.FOUNDER : undefined;
}

function resolveTelegramName(profile: TelegramBotLoginProfile) {
  return profile.username?.trim() || generateFallbackName(profile.id);
}

export function logTelegramBotAuth(event: string, details: Record<string, unknown> = {}) {
  console.info("[telegram-bot-auth]", event, details);
}

async function deleteVerificationTokenSilently(db: TelegramBotAuthDb, token: string) {
  await db.verificationToken.delete({ where: { token } }).catch(() => null);
}

export async function handleTelegramBotStart(
  deps: HandleTelegramBotStartDeps,
  params: {
    loginToken: string;
    telegramUser: TelegramStartUser;
    chatId: string;
    siteUrl: string;
  },
) {
  const { loginToken, telegramUser, chatId, siteUrl } = params;

  logTelegramBotAuth("telegram-user-received", {
    telegramId: telegramUser.id,
    username: telegramUser.username ?? null,
    chatId,
  });
  logTelegramBotAuth("token-received", { token: loginToken });

  const record = await deps.db.verificationToken.findUnique({ where: { token: loginToken } });
  if (!record || record.expires < new Date()) {
    logTelegramBotAuth("login-failure", {
      token: loginToken,
      reason: record ? "expired-token" : "missing-token",
    });
    if (record) {
      await deleteVerificationTokenSilently(deps.db, loginToken);
    }
    await deps.sendTelegramMessage(
      chatId,
      "Ссылка для входа истекла. Вернитесь на сайт и запустите вход через Telegram ещё раз.",
      siteUrl,
    );
    return { ok: false as const, reason: "expired" as const };
  }

  const parsed = parseTelegramBotLoginIdentifier(record.identifier);
  if (!parsed) {
    logTelegramBotAuth("login-failure", {
      token: loginToken,
      reason: "invalid-token-payload",
    });
    await deleteVerificationTokenSilently(deps.db, loginToken);
    await deps.sendTelegramMessage(chatId, "Эта ссылка больше недействительна. Запросите новый вход на сайте.", siteUrl);
    return { ok: false as const, reason: "invalid" as const };
  }

  if (parsed.status === "verified" && parsed.profile) {
    const alreadyLinkedToCurrentUser = parsed.profile.id === telegramUser.id;
    logTelegramBotAuth("account-linking", {
      token: loginToken,
      status: "already-verified",
      telegramId: telegramUser.id,
      matchesExistingTelegram: alreadyLinkedToCurrentUser,
    });

    await deps.sendTelegramMessage(
      chatId,
      alreadyLinkedToCurrentUser
        ? "Этот вход уже подтверждён. Вернитесь на сайт, авторизация завершится автоматически."
        : "Эта ссылка уже подтверждена другим Telegram аккаунтом. Запросите новый вход на сайте.",
      siteUrl,
    );

    return { ok: true as const, reason: "already-verified" as const };
  }

  const photoFileId = await deps.getTelegramPhotoFileId(telegramUser.id);
  const identifier = buildVerifiedTelegramBotLoginIdentifier(
    {
      id: telegramUser.id,
      firstName: telegramUser.firstName ?? null,
      lastName: telegramUser.lastName ?? null,
      username: telegramUser.username ?? null,
      photoFileId,
    },
    parsed.legalAccepted,
  );

  await deps.db.verificationToken.update({
    where: { token: loginToken },
    data: { identifier },
  });

  logTelegramBotAuth("account-linking", {
    token: loginToken,
    status: "verified",
    telegramId: telegramUser.id,
  });

  await deps.sendTelegramMessage(
    chatId,
    "Готово. Вернитесь на сайт, вход или регистрация завершатся автоматически.",
    siteUrl,
  );

  return { ok: true as const, reason: "verified" as const };
}

export async function finalizeTelegramBotLogin(
  deps: FinalizeTelegramBotLoginDeps,
  params: {
    loginToken: string;
    legalAcceptedFallback: boolean;
    context: LoginContext;
  },
) {
  const { loginToken, legalAcceptedFallback, context } = params;

  logTelegramBotAuth("token-received", { token: loginToken });

  const record = await deps.db.verificationToken.findUnique({ where: { token: loginToken } });
  if (!record || record.expires < new Date()) {
    logTelegramBotAuth("login-failure", {
      token: loginToken,
      reason: record ? "expired-token" : "missing-token",
    });
    if (record) {
      await deleteVerificationTokenSilently(deps.db, loginToken);
    }
    return null;
  }

  const parsed = parseTelegramBotLoginIdentifier(record.identifier);
  if (!parsed) {
    logTelegramBotAuth("login-failure", {
      token: loginToken,
      reason: "invalid-token-payload",
    });
    await deleteVerificationTokenSilently(deps.db, loginToken);
    return null;
  }

  if (parsed.status !== "verified" || !parsed.profile) {
    logTelegramBotAuth("login-failure", {
      token: loginToken,
      reason: parsed.status === "pending" ? "token-not-verified-yet" : "missing-profile",
    });
    return null;
  }

  const acceptedLegalDocuments = parsed.legalAccepted || legalAcceptedFallback;
  const profile = parsed.profile;
  const image = profile.photoFileId ? `telegram-file:${profile.photoFileId}` : undefined;
  const resolvedName = resolveTelegramName(profile);

  logTelegramBotAuth("telegram-user-received", {
    token: loginToken,
    telegramId: profile.id,
    username: profile.username ?? null,
  });

  let user = await deps.db.user.findUnique({
    where: { telegramId: profile.id },
  });

  logTelegramBotAuth("user-lookup", {
    token: loginToken,
    telegramId: profile.id,
    found: Boolean(user),
  });

  if (user) {
    if (user.isBanned) {
      await deleteVerificationTokenSilently(deps.db, loginToken);
      await deps.createLoginHistory({
        userId: user.id,
        email: user.email,
        status: LoginAttemptStatus.FAILED,
        context,
      });
      logTelegramBotAuth("login-failure", {
        token: loginToken,
        telegramId: profile.id,
        reason: "banned-user",
      });
      return null;
    }

    user = await deps.db.user.update({
      where: { id: user.id },
      data: {
        telegramUsername: profile.username ?? null,
        image: image ?? user.image ?? undefined,
        role: getExistingRoleUpdate(profile.id),
        ...(!user.legalAcceptedAt && acceptedLegalDocuments ? deps.getLegalAcceptanceData() : {}),
      },
    });

    logTelegramBotAuth("account-linking", {
      token: loginToken,
      telegramId: profile.id,
      userId: user.id,
      action: "updated-existing-user",
    });
  } else {
    if (!acceptedLegalDocuments) {
      logTelegramBotAuth("login-failure", {
        token: loginToken,
        telegramId: profile.id,
        reason: "legal-documents-not-accepted",
      });
      return null;
    }

    try {
      user = await deps.db.user.create({
        data: {
          publicId: await deps.generateUniquePublicPlayerId(),
          telegramId: profile.id,
          telegramUsername: profile.username ?? null,
          image,
          name: resolvedName,
          role: getTelegramRole(profile.id),
          ...deps.getLegalAcceptanceData(),
        },
      });

      logTelegramBotAuth("account-creation", {
        token: loginToken,
        telegramId: profile.id,
        userId: user.id,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      user = await deps.db.user.findUnique({
        where: { telegramId: profile.id },
      });

      if (!user) {
        throw error;
      }

      logTelegramBotAuth("account-linking", {
        token: loginToken,
        telegramId: profile.id,
        userId: user.id,
        action: "recovered-after-unique-conflict",
      });
    }
  }

  if (!user.name?.trim()) {
    user = await deps.db.user.update({
      where: { id: user.id },
      data: { name: resolvedName },
    });
  }

  await deleteVerificationTokenSilently(deps.db, loginToken);

  const authSessionId = await deps.createSecuritySession({
    userId: user.id,
    context,
  });

  await deps.createLoginHistory({
    userId: user.id,
    email: user.email,
    status: LoginAttemptStatus.SUCCESS,
    context,
  });

  logTelegramBotAuth("login-success", {
    token: loginToken,
    telegramId: profile.id,
    userId: user.id,
    authSessionId,
  });

  return {
    id: user.id,
    email: user.email,
    image: user.image,
    name: user.name ?? "Telegram Player",
    role: user.role,
    telegramUsername: user.telegramUsername,
    isBanned: user.isBanned,
    authSessionId,
  };
}

