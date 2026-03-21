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

export function verifyTelegramAuth(payload: TelegramPayload, botToken: string) {
  const checkString = TELEGRAM_AUTH_FIELDS
    .map((key) => [key, payload[key]] as const)
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();
  const signature = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  return signature === payload.hash;
}
