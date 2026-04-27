import crypto from "crypto";

export type TelegramPayload = {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
};

const TELEGRAM_AUTH_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "username",
  "photo_url",
  "auth_date",
] as const;

export function verifyTelegramAuth(payload: TelegramPayload, botToken: string, maxAgeSeconds = 24 * 60 * 60) {
  const authDate = Number(payload.auth_date);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!Number.isFinite(authDate) || authDate <= 0) return false;
  if (authDate > nowSeconds + 60) return false;
  if (nowSeconds - authDate > maxAgeSeconds) return false;

  const checkString = TELEGRAM_AUTH_FIELDS
    .map((key) => [key, payload[key]] as const)
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();
  const signature = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(payload.hash, "hex"));
  } catch {
    return false;
  }
}
