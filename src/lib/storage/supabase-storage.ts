import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "public-media";

export type StorageFolder = "avatars" | "banners" | "tournaments" | "divisions" | "faq" | "lineups";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

let cachedClient: SupabaseClient | null = null;

function getServiceClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase storage is not configured");
  }

  // Service-role ключ обходит RLS. Клиент создаётся только на сервере и
  // используется после проверки сессии в вызывающем коде.
  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export function isStorageConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function extensionForContentType(contentType: string, fallback = "bin") {
  return EXTENSION_BY_MIME[contentType] ?? fallback;
}

/**
 * Загружает бинарные данные в публичный бакет и возвращает public URL.
 * Имя файла случайное, чтобы исключить коллизии и перезапись чужих файлов.
 */
export async function uploadToStorage(params: {
  folder: StorageFolder;
  bytes: ArrayBuffer | Buffer | Uint8Array;
  contentType: string;
  ext?: string;
  path?: string;
  cacheControl?: string;
}) {
  const client = getServiceClient();
  const ext = params.ext ?? extensionForContentType(params.contentType);
  const path = params.path ?? `${params.folder}/${randomUUID()}.${ext}`;
  const body = params.bytes instanceof ArrayBuffer ? Buffer.from(params.bytes) : params.bytes;

  const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, body, {
    contentType: params.contentType,
    cacheControl: params.cacheControl,
    upsert: false,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
