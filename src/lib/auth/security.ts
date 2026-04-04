import { randomUUID } from "crypto";
import { LoginAttemptStatus } from "@prisma/client";
import { db } from "@/lib/db";

type HeaderLike =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined
  | null;

type SecurityContext = {
  ipAddress: string | null;
  userAgent: string;
  device: string;
  platform: string;
  location: string;
};

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
  return "Не определено";
}

function parseDevice(userAgent: string) {
  const browser = parseBrowser(userAgent);
  const platform = parsePlatform(userAgent);

  if (platform === "iPhone" || platform === "Android") {
    return `${browser} на ${platform}`;
  }

  if (platform === "Не определено") {
    return browser;
  }

  return `${browser} на ${platform}`;
}

function parseCountryName(countryCode: string) {
  if (!countryCode) return "";

  try {
    const displayNames = new Intl.DisplayNames(["ru"], { type: "region" });
    return displayNames.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase();
  } catch {
    return countryCode.toUpperCase();
  }
}

function parseLocation(headers: HeaderLike) {
  const city =
    getHeader(headers, "x-vercel-ip-city") ??
    getHeader(headers, "x-city") ??
    getHeader(headers, "cf-ipcity") ??
    "";
  const countryCode =
    getHeader(headers, "x-vercel-ip-country") ??
    getHeader(headers, "cf-ipcountry") ??
    getHeader(headers, "x-country") ??
    "";

  const country = parseCountryName(countryCode);
  const parts = [country, city].map((value) => value.trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : "Не определено";
}

export function buildSecurityContext(headers: HeaderLike): SecurityContext {
  const userAgent = getHeader(headers, "user-agent") ?? "Неизвестное устройство";
  const forwarded = getHeader(headers, "x-forwarded-for");
  const realIp = getHeader(headers, "x-real-ip");
  const ipAddress = (forwarded?.split(",")[0] ?? realIp ?? "").trim() || null;

  return {
    ipAddress,
    userAgent,
    device: parseDevice(userAgent),
    platform: parsePlatform(userAgent),
    location: parseLocation(headers),
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
    },
  });

  return authSessionId;
}

export async function touchSecuritySession(authSessionId: string) {
  await db.securitySession.updateMany({
    where: {
      authSessionId,
      revokedAt: null,
    },
    data: {
      lastActiveAt: new Date(),
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
