import crypto from "crypto";

export type TelegramOidcMode = "login" | "register" | "connect";

export type TelegramOidcStatePayload = {
  mode: TelegramOidcMode;
  legalAccepted: boolean;
  nonce: string;
  codeVerifier: string;
};

export type TelegramOidcProfile = {
  subject: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  picture?: string | null;
};

export type TelegramOidcResultPayload = {
  mode: TelegramOidcMode;
  legalAccepted: boolean;
  profile: TelegramOidcProfile;
};

const STATE_PREFIX = "telegram-oidc-state";
const RESULT_PREFIX = "telegram-oidc-result";

function encodePayload<T>(prefix: string, payload: T) {
  return `${prefix}:${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
}

function decodePayload<T>(value: string, prefix: string) {
  if (!value.startsWith(`${prefix}:`)) return null;

  try {
    return JSON.parse(Buffer.from(value.slice(prefix.length + 1), "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function createTelegramOidcStatePayloadIdentifier(payload: TelegramOidcStatePayload) {
  return encodePayload(STATE_PREFIX, payload);
}

export function parseTelegramOidcStatePayloadIdentifier(value: string) {
  return decodePayload<TelegramOidcStatePayload>(value, STATE_PREFIX);
}

export function createTelegramOidcResultPayloadIdentifier(payload: TelegramOidcResultPayload) {
  return encodePayload(RESULT_PREFIX, payload);
}

export function parseTelegramOidcResultPayloadIdentifier(value: string) {
  return decodePayload<TelegramOidcResultPayload>(value, RESULT_PREFIX);
}

export function createTelegramOidcToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function createTelegramOidcPkceVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

export function createTelegramOidcNonce() {
  return crypto.randomBytes(24).toString("base64url");
}

export function createTelegramOidcCodeChallenge(codeVerifier: string) {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

export function getTelegramOidcFinishPath(mode: TelegramOidcMode) {
  switch (mode) {
    case "register":
      return "/register";
    case "connect":
      return "/dashboard/security";
    case "login":
    default:
      return "/login";
  }
}

export function getTelegramOidcClientId() {
  return process.env.TELEGRAM_CLIENT_ID?.trim() || "";
}

export function getTelegramOidcClientSecret() {
  return process.env.TELEGRAM_CLIENT_SECRET?.trim() || "";
}
