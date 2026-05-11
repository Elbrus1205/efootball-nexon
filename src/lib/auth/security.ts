import { randomUUID } from "crypto";
import { LoginAttemptStatus } from "@prisma/client";
import { db } from "@/lib/db";

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
};

type IpApiResponse = {
  status?: string;
  country?: string;
  city?: string;
  regionName?: string;
};

const UNKNOWN_LOCATION = "Не определено";
const UNKNOWN_DEVICE = "Неизвестное устройство";
const locationCache = new Map<string, { value: string; expiresAt: number }>();
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

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

function parseCountryName(countryCode: string) {
  if (!countryCode) return "";

  try {
    const displayNames = new Intl.DisplayNames(["ru"], { type: "region" });
    return displayNames.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase();
  } catch {
    return countryCode.toUpperCase();
  }
}

function isPublicIp(ipAddress: string | null) {
  if (!ipAddress) return false;

  const normalized = ipAddress.trim().replace(/^::ffff:/, "");
  if (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) ||
    /^169\.254\./.test(normalized) ||
    /^fc/i.test(normalized) ||
    /^fd/i.test(normalized) ||
    /^fe80:/i.test(normalized)
  ) {
    return false;
  }

  return true;
}

function formatLocation(parts: Array<string | null | undefined>) {
  const uniqueParts = Array.from(new Set(parts.map((part) => part?.trim()).filter(Boolean) as string[]));
  return uniqueParts.length ? uniqueParts.join(", ") : UNKNOWN_LOCATION;
}

async function resolveLocationByIp(ipAddress: string | null) {
  if (!isPublicIp(ipAddress)) return UNKNOWN_LOCATION;

  const cached = locationCache.get(ipAddress!);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ipAddress!)}?fields=status,country,regionName,city&lang=ru`,
      {
        signal: controller.signal,
        headers: {
          "user-agent": "eFootball Nexon security sessions",
        },
      },
    );

    if (!response.ok) return UNKNOWN_LOCATION;

    const data = (await response.json().catch(() => null)) as IpApiResponse | null;
    if (!data || data.status !== "success") return UNKNOWN_LOCATION;

    const location = formatLocation([data.country, data.regionName, data.city]);
    locationCache.set(ipAddress!, {
      value: location,
      expiresAt: Date.now() + LOCATION_CACHE_TTL_MS,
    });
    return location;
  } catch {
    return UNKNOWN_LOCATION;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildSecurityContext(headers: HeaderLike): SecurityContext {
  const userAgent = getHeader(headers, "user-agent") ?? UNKNOWN_DEVICE;
  const forwarded = getHeader(headers, "x-forwarded-for");
  const realIp = getHeader(headers, "x-real-ip");
  const ipAddress = (forwarded?.split(",")[0] ?? realIp ?? "").trim() || null;

  return {
    ipAddress,
    userAgent,
    device: parseDevice(userAgent),
    platform: parsePlatform(userAgent),
    location: UNKNOWN_LOCATION,
  };
}

export async function resolveSecurityContext(headers: HeaderLike): Promise<SecurityContext> {
  const context = buildSecurityContext(headers);
  return {
    ...context,
    location: await resolveLocationByIp(context.ipAddress),
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
