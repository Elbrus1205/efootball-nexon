import { createHash, randomUUID } from "crypto";
import sharp from "sharp";
import { isTelegramAssetUrl } from "@/lib/telegram-assets";
import { isStorageConfigured, uploadToStorage, type StorageFolder } from "@/lib/storage/supabase-storage";

export const IMMUTABLE_MEDIA_CACHE_CONTROL = "31536000";

const MAX_REMOTE_IMAGE_BYTES = 6 * 1024 * 1024;
const SUPPORTED_INPUT_TYPES = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);

export type ProcessedMedia = {
  bytes: Buffer;
  contentType: "image/webp";
  ext: "webp";
};

function normalizeContentType(contentType?: string | null) {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isProcessableImageType(contentType?: string | null) {
  return SUPPORTED_INPUT_TYPES.has(normalizeContentType(contentType));
}

export function shouldReplaceAvatarWithTelegram(currentImage?: string | null) {
  if (!currentImage) return true;
  if (currentImage.startsWith("telegram-file:")) return true;
  if (currentImage.startsWith("/api/telegram/image")) return true;
  return isTelegramAssetUrl(currentImage);
}

export async function normalizeAvatarImage(bytes: ArrayBuffer | Buffer | Uint8Array, contentType?: string | null, options: { size?: number; quality?: number } = {}): Promise<ProcessedMedia> {
  if (!isProcessableImageType(contentType)) {
    throw new Error("Unsupported avatar image type.");
  }

  const size = options.size ?? 512;
  const quality = options.quality ?? 84;
  const input = bytes instanceof ArrayBuffer ? Buffer.from(bytes) : Buffer.from(bytes);
  const output = await sharp(input, { animated: false, limitInputPixels: 40_000_000 })
    .rotate()
    .resize(size, size, { fit: "cover", position: "center", withoutEnlargement: false })
    .webp({ quality, effort: 4 })
    .toBuffer();

  return { bytes: output, contentType: "image/webp", ext: "webp" };
}

export async function normalizeBannerImage(bytes: ArrayBuffer | Buffer | Uint8Array, contentType?: string | null): Promise<ProcessedMedia> {
  if (!isProcessableImageType(contentType)) {
    throw new Error("Unsupported banner image type.");
  }

  const input = bytes instanceof ArrayBuffer ? Buffer.from(bytes) : Buffer.from(bytes);
  const output = await sharp(input, { animated: false, limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: 1600, height: 900, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  return { bytes: output, contentType: "image/webp", ext: "webp" };
}

export async function normalizeShopProductImage(bytes: ArrayBuffer | Buffer | Uint8Array, contentType?: string | null): Promise<ProcessedMedia> {
  if (!isProcessableImageType(contentType)) throw new Error("Unsupported product image type.");
  const input = bytes instanceof ArrayBuffer ? Buffer.from(bytes) : Buffer.from(bytes);
  const output = await sharp(input, { animated: false, limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1000, fit: "cover", position: "center", withoutEnlargement: true })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();
  return { bytes: output, contentType: "image/webp", ext: "webp" };
}

export async function normalizeProfileUploadImage(folder: StorageFolder, bytes: ArrayBuffer | Buffer | Uint8Array, contentType?: string | null) {
  if (folder === "avatars") return normalizeAvatarImage(bytes, contentType);
  if (folder === "banners") return normalizeBannerImage(bytes, contentType);
  if (folder === "lineups") return normalizeBannerImage(bytes, contentType);
  if (folder === "tournaments") return normalizeBannerImage(bytes, contentType);
  if (folder === "divisions") return normalizeBannerImage(bytes, contentType);
  if (folder === "faq" && contentType !== "application/pdf") return normalizeBannerImage(bytes, contentType);
  if (folder === "shop-products") return normalizeShopProductImage(bytes, contentType);
  return null;
}

async function fetchTelegramImageBytes(src: string) {
  const response = await fetch(src, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: {
      "User-Agent": "Mozilla/5.0 efootball-nexon media cache",
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
    },
  }).catch(() => null);

  if (!response?.ok) return null;

  const contentType = normalizeContentType(response.headers.get("content-type"));
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (!isProcessableImageType(contentType) || contentLength > MAX_REMOTE_IMAGE_BYTES) return null;

  const bytes = await response.arrayBuffer().catch(() => null);
  if (!bytes || bytes.byteLength > MAX_REMOTE_IMAGE_BYTES) return null;

  return { bytes, contentType };
}

function safeIdentity(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "telegram";
}

export async function cacheTelegramAvatarToStorage(src?: string | null, identity = "telegram") {
  if (!src || !isStorageConfigured() || !isTelegramAssetUrl(src)) return src ?? undefined;

  const remote = await fetchTelegramImageBytes(src);
  if (!remote) return src;

  const processed = await normalizeAvatarImage(remote.bytes, remote.contentType, { size: 384, quality: 84 });
  const hash = createHash("sha256").update(processed.bytes).digest("hex").slice(0, 24);
  const path = `avatars/telegram/${safeIdentity(identity)}/${hash}-${randomUUID()}.webp`;

  return uploadToStorage({
    folder: "avatars",
    path,
    bytes: processed.bytes,
    contentType: processed.contentType,
    ext: processed.ext,
    cacheControl: IMMUTABLE_MEDIA_CACHE_CONTROL,
  });
}

export async function maybeCacheTelegramAvatar(params: {
  telegramImage?: string | null;
  currentImage?: string | null;
  identity: string;
}) {
  if (!params.telegramImage || !shouldReplaceAvatarWithTelegram(params.currentImage)) return undefined;

  try {
    return await cacheTelegramAvatarToStorage(params.telegramImage, params.identity);
  } catch (error) {
    console.warn("[media] telegram-avatar-cache-failed", {
      identity: params.identity,
      error: error instanceof Error ? error.message : "unknown-error",
    });
    return params.telegramImage;
  }
}
