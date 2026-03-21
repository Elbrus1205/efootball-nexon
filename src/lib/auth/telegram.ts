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

export function verifyTelegramAuth(payload: TelegramPayload, botToken: string) {
  const { hash, ...data } = payload;
  const checkString = Object.entries(data)
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();
  const signature = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  return signature === hash;
}
