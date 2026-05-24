import crypto from "crypto";

export type TelegramMiniAppUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  languageCode?: string | null;
  photoUrl?: string | null;
};

export type TelegramMiniAppInitData = {
  authDate: Date;
  queryId?: string | null;
  startParam?: string | null;
  user: TelegramMiniAppUser;
};

const DEFAULT_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

function getTelegramBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("telegram-bot-token-missing");
  return token;
}

function getAuthMaxAgeSeconds() {
  const configured = Number(process.env.TELEGRAM_MINI_APP_AUTH_MAX_AGE_SECONDS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_AUTH_MAX_AGE_SECONDS;
}

function safeParseJson(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getTelegramUser(rawUser: unknown): TelegramMiniAppUser {
  if (!isRecord(rawUser)) throw new Error("telegram-miniapp-user-invalid");

  const id = rawUser.id;
  const telegramId = typeof id === "number" || typeof id === "string" ? String(id).trim() : "";
  if (!telegramId || !/^\d+$/.test(telegramId)) throw new Error("telegram-miniapp-user-id-invalid");

  return {
    id: telegramId,
    firstName: getString(rawUser.first_name),
    lastName: getString(rawUser.last_name),
    username: getString(rawUser.username),
    languageCode: getString(rawUser.language_code),
    photoUrl: getString(rawUser.photo_url),
  };
}

function getDataCheckString(params: URLSearchParams, options?: { excludeSignature?: boolean }) {
  return Array.from(params.entries())
    .filter(([key]) => key !== "hash" && (!options?.excludeSignature || key !== "signature"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function calculateTelegramInitDataHash(dataCheckString: string) {
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(getTelegramBotToken()).digest();
  return crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;

  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function verifyTelegramMiniAppInitData(initData: string): TelegramMiniAppInitData {
  const normalizedInitData = initData.trim();
  if (!normalizedInitData) throw new Error("telegram-miniapp-init-data-missing");

  const params = new URLSearchParams(normalizedInitData);
  const receivedHash = params.get("hash")?.trim() ?? "";
  if (!receivedHash) throw new Error("telegram-miniapp-hash-missing");

  const expectedHash = calculateTelegramInitDataHash(getDataCheckString(params));
  const expectedHashWithoutSignature = calculateTelegramInitDataHash(getDataCheckString(params, { excludeSignature: true }));
  if (!safeEqualHex(receivedHash, expectedHash) && !safeEqualHex(receivedHash, expectedHashWithoutSignature)) {
    throw new Error("telegram-miniapp-hash-invalid");
  }

  const authDateSeconds = Number(params.get("auth_date"));
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    throw new Error("telegram-miniapp-auth-date-invalid");
  }

  const authDate = new Date(authDateSeconds * 1000);
  const ageSeconds = Math.floor((Date.now() - authDate.getTime()) / 1000);
  if (ageSeconds < -60 || ageSeconds > getAuthMaxAgeSeconds()) {
    throw new Error("telegram-miniapp-auth-date-expired");
  }

  return {
    authDate,
    queryId: params.get("query_id"),
    startParam: params.get("start_param"),
    user: getTelegramUser(safeParseJson(params.get("user"))),
  };
}
