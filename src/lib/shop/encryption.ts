import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function getEncryptionKey() {
  const configured = process.env.SHOP_ENC_KEY?.trim();
  if (!configured) {
    throw new Error("SHOP_ENC_KEY не настроен.");
  }

  const decoded = /^[a-f\d]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (decoded.length !== 32) {
    throw new Error("SHOP_ENC_KEY должен содержать 32 байта в base64 или 64 hex-символа.");
  }
  return decoded;
}

export function encryptShopField(value: string) {
  const normalized = value.trim();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptShopField(payload: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (version !== VERSION || !ivRaw || !tagRaw || !encryptedRaw) throw new Error("Формат зашифрованного поля не поддерживается.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function maskShopField(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 2) return "•".repeat(normalized.length || 1);
  if (normalized.length <= 6) return `${normalized[0]}${"•".repeat(normalized.length - 2)}${normalized.at(-1)}`;
  return `${normalized.slice(0, 2)}${"•".repeat(Math.min(8, normalized.length - 4))}${normalized.slice(-2)}`;
}

export function fingerprintShopField(value: string) {
  return createHash("sha256").update(value.trim()).digest("base64url");
}
