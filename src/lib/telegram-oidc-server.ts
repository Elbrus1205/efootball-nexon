import crypto from "crypto";
import { setDefaultResultOrder } from "dns";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTPayload } from "jose";
import { db } from "@/lib/db";
import { type TelegramOidcProfile, getTelegramOidcClientId } from "@/lib/telegram-oidc";

const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json";
const TELEGRAM_FETCH_TIMEOUT_MS = 15_000;
const TELEGRAM_FETCH_RETRIES = 2;
const TELEGRAM_JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
const TELEGRAM_ID_TOKEN_REPLAY_PREFIX = "telegram-oidc-replay";
const TELEGRAM_ID_TOKEN_REPLAY_TTL_MS = 10 * 60 * 1000;

let telegramJwksCache: ReturnType<typeof createLocalJWKSet> | null = null;
let telegramJwksCacheExpiresAt = 0;

try {
  setDefaultResultOrder("ipv4first");
} catch {
  // Ignore when the host runtime does not support overriding DNS result order.
}

type TelegramOidcClaims = JWTPayload & {
  id?: string | number;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  username?: string;
  picture?: string;
  phone_number?: string;
};

export function describeTelegramOidcError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: "unknown-error",
      cause: null as string | null,
    };
  }

  let cause: string | null = null;
  const rawCause = error.cause;

  if (rawCause instanceof Error) {
    cause = rawCause.message;
  } else if (typeof rawCause === "string") {
    cause = rawCause;
  } else if (rawCause && typeof rawCause === "object") {
    try {
      cause = JSON.stringify(rawCause);
    } catch {
      cause = String(rawCause);
    }
  }

  return {
    message: error.message,
    cause,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url: string, init: RequestInit, stage: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= TELEGRAM_FETCH_RETRIES + 1; attempt += 1) {
    try {
      return await fetchWithTimeout(url, init, TELEGRAM_FETCH_TIMEOUT_MS);
    } catch (error) {
      lastError = error;
      const described = describeTelegramOidcError(error);

      console.warn("[telegram-oidc] fetch-retry", {
        stage,
        attempt,
        error: described.message,
        cause: described.cause,
      });

      if (attempt <= TELEGRAM_FETCH_RETRIES) {
        await sleep(400 * attempt);
      }
    }
  }

  const finalError = new Error(`${stage}-fetch-failed`);
  (finalError as Error & { cause?: unknown }).cause = lastError;
  throw finalError;
}

async function parseJsonResponse<T>(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null as T | null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T | null;
  }
}

async function getTelegramJwks(forceRefresh = false) {
  if (!forceRefresh && telegramJwksCache && telegramJwksCacheExpiresAt > Date.now()) {
    return telegramJwksCache;
  }

  const response = await fetchWithRetry(
    TELEGRAM_JWKS_URL,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
    "jwks",
  );

  const jwks = await parseJsonResponse<JSONWebKeySet>(response);
  if (!response.ok || !jwks?.keys?.length) {
    throw new Error("jwks-response-invalid");
  }

  telegramJwksCache = createLocalJWKSet(jwks);
  telegramJwksCacheExpiresAt = Date.now() + TELEGRAM_JWKS_CACHE_TTL_MS;
  return telegramJwksCache;
}

function isUnknownKidError(error: unknown) {
  return error instanceof Error && /no applicable key|json web key set/i.test(error.message);
}

async function verifyTelegramIdToken(idToken: string) {
  const clientId = getTelegramOidcClientId();
  if (!clientId) {
    throw new Error("telegram-client-id-missing");
  }

  try {
    const jwks = await getTelegramJwks();
    return await jwtVerify(idToken, jwks, {
      issuer: TELEGRAM_ISSUER,
      audience: clientId,
    });
  } catch (error) {
    if (!isUnknownKidError(error)) {
      throw error;
    }

    const jwks = await getTelegramJwks(true);
    return jwtVerify(idToken, jwks, {
      issuer: TELEGRAM_ISSUER,
      audience: clientId,
    });
  }
}

async function markTelegramIdTokenAsUsed(idToken: string) {
  const replayToken = crypto.createHash("sha256").update(idToken).digest("base64url");
  const existingRecord = await db.verificationToken.findUnique({
    where: { token: replayToken },
  });

  if (existingRecord) {
    if (existingRecord.expires > new Date()) {
      return false;
    }

    await db.verificationToken.delete({ where: { token: replayToken } }).catch(() => null);
  }

  try {
    await db.verificationToken.create({
      data: {
        token: replayToken,
        identifier: TELEGRAM_ID_TOKEN_REPLAY_PREFIX,
        expires: new Date(Date.now() + TELEGRAM_ID_TOKEN_REPLAY_TTL_MS),
      },
    });
  } catch (error) {
    const freshRecord = await db.verificationToken.findUnique({
      where: { token: replayToken },
    });

    if (freshRecord && freshRecord.expires > new Date()) {
      return false;
    }

    throw error;
  }

  return true;
}

export async function verifyAndConsumeTelegramIdToken(idToken: string): Promise<TelegramOidcProfile> {
  const normalizedIdToken = idToken.trim();
  if (!normalizedIdToken) {
    throw new Error("missing-id-token");
  }

  const verification = await verifyTelegramIdToken(normalizedIdToken);
  const claims = verification.payload as TelegramOidcClaims;

  const telegramId = String(claims.id ?? claims.sub ?? "").trim();
  if (!telegramId) {
    throw new Error("missing-telegram-id");
  }

  if (!claims.sub?.trim()) {
    throw new Error("missing-sub");
  }

  const accepted = await markTelegramIdTokenAsUsed(normalizedIdToken);
  if (!accepted) {
    throw new Error("id-token-already-used");
  }

  const firstName = claims.given_name?.trim() || null;
  const lastName = claims.family_name?.trim() || null;
  const fullName = claims.name?.trim() || [firstName, lastName].filter(Boolean).join(" ").trim() || null;

  return {
    subject: claims.sub.trim(),
    telegramId,
    username: claims.preferred_username?.trim() || claims.username?.trim() || null,
    firstName,
    lastName,
    fullName,
    picture: claims.picture?.trim() || null,
  };
}
