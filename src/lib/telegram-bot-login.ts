import { randomBytes } from "crypto";

export type TelegramBotLoginProfile = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  photoFileId?: string | null;
};

const prefix = "telegram-bot-login";
const pendingMarker = "pending";
const verifiedMarker = "verified";

function encodeProfile(profile: TelegramBotLoginProfile) {
  return Buffer.from(JSON.stringify(profile), "utf8").toString("base64url");
}

function decodeProfile(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as TelegramBotLoginProfile;
  } catch {
    return null;
  }
}

export function createTelegramBotLoginToken() {
  return randomBytes(24).toString("base64url");
}

export function getTelegramBotLoginStartParam(token: string) {
  return `login_${token}`;
}

export function parseTelegramBotLoginStartParam(value?: string | null) {
  const token = value?.trim().match(/^login_([A-Za-z0-9_-]{20,80})$/)?.[1];
  return token ?? null;
}

export function buildPendingTelegramBotLoginIdentifier(legalAccepted: boolean) {
  return [prefix, pendingMarker, legalAccepted ? "1" : "0"].join(":");
}

export function buildVerifiedTelegramBotLoginIdentifier(profile: TelegramBotLoginProfile, legalAccepted: boolean) {
  return [prefix, verifiedMarker, legalAccepted ? "1" : "0", encodeProfile(profile)].join(":");
}

export function parseTelegramBotLoginIdentifier(identifier: string) {
  const [currentPrefix, status, legalAccepted, profile] = identifier.split(":");
  if (currentPrefix !== prefix) return null;

  if (status === pendingMarker) {
    return { status, legalAccepted: legalAccepted === "1", profile: null };
  }

  if (status === verifiedMarker && profile) {
    const parsedProfile = decodeProfile(profile);
    if (!parsedProfile?.id) return null;

    return { status, legalAccepted: legalAccepted === "1", profile: parsedProfile };
  }

  return null;
}
