import { createHash, randomUUID } from "crypto";
import { LoginAttemptStatus } from "@prisma/client";
import { getTrustedClientAddress } from "@/lib/client-address";
import { db } from "@/lib/db";
import { getSessionActivityCutoff } from "@/lib/auth/session-activity";

type HeaderLike =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined
  | null;

export type SecurityContext = {
  ipAddress: string | null;
  userAgent: string;
  device: string;
  platform: string;
  location: string;
  deviceFingerprint: string | null;
};

const UNKNOWN_LOCATION = "Не определено";
const UNKNOWN_DEVICE = "Неизвестное устройство";

function getHeader(headers: HeaderLike, name: string) {
  if (!headers) return null;

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0] ?? null;
  return direct ?? null;
}

function parseBrowser(userAgent: string) {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent) && !/chrome|crios|edg/i.test(userAgent)) return "Safari";
  if (/telegram/i.test(userAgent)) return "Telegram";
  return "Браузер";
}

function parsePlatform(userAgent: string) {
  if (/iphone|ipad|ios/i.test(userAgent)) return "iPhone";
  if (/android/i.test(userAgent)) return "Android";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os|macintosh/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return UNKNOWN_LOCATION;
}

function parseDevice(userAgent: string) {
  const browser = parseBrowser(userAgent);
  const platform = parsePlatform(userAgent);

  if (platform === "iPhone" || platform === "Android") {
    return `${browser} на ${platform}`;
  }

  if (platform === UNKNOWN_LOCATION) {
    return browser;
  }

  return `${browser} на ${platform}`;
}

export function buildSecurityContext(headers: HeaderLike): SecurityContext {
  const userAgent = getHeader(headers, "user-agent") ?? UNKNOWN_DEVICE;
  const ipAddress = getTrustedClientAddress(headers);

  return {
    ipAddress,
    userAgent,
    device: parseDevice(userAgent),
    platform: parsePlatform(userAgent),
    location: UNKNOWN_LOCATION,
    deviceFingerprint: null,
  };
}

export async function resolveSecurityContext(headers: HeaderLike): Promise<SecurityContext> {
  return buildSecurityContext(headers);
}

/**
 * Хэширует пришедший с клиента отпечаток ещё раз с серверной солью, чтобы в БД
 * не лежало значение, которое клиент может воспроизвести напрямую. Возвращает
 * null для пустых/некорректных значений (вход не должен зависеть от отпечатка).
 */
export function hashDeviceFingerprint(rawFingerprint: unknown): string | null {
  if (typeof rawFingerprint !== "string") return null;
  const trimmed = rawFingerprint.trim();
  // Клиент шлёт hex SHA-256 (64 символа). Отсекаем мусор и слишком длинные строки.
  if (trimmed.length < 16 || trimmed.length > 256) return null;

  const salt = process.env.FINGERPRINT_SALT ?? "";
  return createHash("sha256").update(`${salt}:${trimmed}`).digest("hex");
}

/** Возвращает копию контекста с добавленным (уже хэшированным) отпечатком. */
export function withDeviceFingerprint(context: SecurityContext, rawFingerprint: unknown): SecurityContext {
  return {
    ...context,
    deviceFingerprint: hashDeviceFingerprint(rawFingerprint),
  };
}

export async function createLoginHistory(params: {
  userId?: string | null;
  email?: string | null;
  status: LoginAttemptStatus;
  context: SecurityContext;
}) {
  await db.loginHistory.create({
    data: {
      userId: params.userId ?? null,
      email: params.email ?? null,
      status: params.status,
      device: params.context.device,
      platform: params.context.platform,
      location: params.context.location,
      ipAddress: params.context.ipAddress,
      userAgent: params.context.userAgent,
      deviceFingerprint: params.context.deviceFingerprint,
    },
  });
}

export async function createSecuritySession(params: {
  userId: string;
  authSessionId?: string;
  context: SecurityContext;
}) {
  const authSessionId = params.authSessionId ?? randomUUID();

  await db.securitySession.create({
    data: {
      authSessionId,
      userId: params.userId,
      device: params.context.device,
      platform: params.context.platform,
      location: params.context.location,
      ipAddress: params.context.ipAddress,
      userAgent: params.context.userAgent,
      deviceFingerprint: params.context.deviceFingerprint,
    },
  });

  return authSessionId;
}

export async function touchSecuritySession(authSessionId: string, now = new Date()) {
  await db.securitySession.updateMany({
    where: {
      authSessionId,
      revokedAt: null,
      lastActiveAt: { lt: getSessionActivityCutoff(now) },
    },
    data: {
      lastActiveAt: now,
    },
  });
}

export async function revokeSecuritySessions(userId: string, authSessionIds?: string[]) {
  await db.securitySession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(authSessionIds ? { authSessionId: { in: authSessionIds } } : {}),
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function deleteSecuritySessions(userId: string, authSessionIds?: string[]) {
  await db.securitySession.deleteMany({
    where: {
      userId,
      ...(authSessionIds ? { authSessionId: { in: authSessionIds } } : {}),
    },
  });
}
