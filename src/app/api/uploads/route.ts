import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { IMMUTABLE_MEDIA_CACHE_CONTROL, normalizeProfileUploadImage } from "@/lib/media-processing";
import { roleHasPermission } from "@/lib/role-permissions";
import { isStorageConfigured, uploadToStorage, type StorageFolder } from "@/lib/storage/supabase-storage";
import { getRequiredUploadPermission } from "@/lib/storage/upload-policy";
import { enforceRateLimit } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/avif", "image/png", "image/jpeg", "image/webp"]);
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/avif", "image/png", "image/jpeg", "image/webp"]);
const ALLOWED_FAQ_TYPES = new Set(["image/avif", "image/png", "image/jpeg", "image/webp", "application/pdf"]);

const FOLDER_RULES: Record<StorageFolder, { maxBytes: number; allowed: Set<string> }> = {
  avatars: { maxBytes: 4 * 1024 * 1024, allowed: ALLOWED_PROFILE_IMAGE_TYPES },
  banners: { maxBytes: 8 * 1024 * 1024, allowed: ALLOWED_PROFILE_IMAGE_TYPES },
  tournaments: { maxBytes: 16 * 1024 * 1024, allowed: ALLOWED_IMAGE_TYPES },
  divisions: { maxBytes: 16 * 1024 * 1024, allowed: ALLOWED_IMAGE_TYPES },
  faq: { maxBytes: 16 * 1024 * 1024, allowed: ALLOWED_FAQ_TYPES },
  lineups: { maxBytes: 10 * 1024 * 1024, allowed: ALLOWED_PROFILE_IMAGE_TYPES },
};

function isStorageFolder(value: string): value is StorageFolder {
  return value in FOLDER_RULES;
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user?.id || session.user.isBanned) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  const limited = enforceRateLimit(request, "uploads", { limit: 20, windowMs: 60 * 1_000 }, session.user.id);
  if (limited) return limited;

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Хранилище не настроено." }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const folderRaw = String(formData?.get("folder") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан." }, { status: 400 });
  }

  if (!isStorageFolder(folderRaw)) {
    return NextResponse.json({ error: "Некорректная папка загрузки." }, { status: 400 });
  }

  const requiredPermission = getRequiredUploadPermission(folderRaw);
  if (requiredPermission && !(await roleHasPermission(session.user.role, requiredPermission))) {
    return NextResponse.json({ error: "Нет прав на загрузку в этот раздел." }, { status: 403 });
  }

  const rules = FOLDER_RULES[folderRaw];
  const contentType = file.type || "application/octet-stream";

  if (!rules.allowed.has(contentType)) {
    return NextResponse.json({ error: "Недопустимый тип файла." }, { status: 400 });
  }

  if (file.size > rules.maxBytes) {
    const maxMb = Math.round(rules.maxBytes / (1024 * 1024));
    return NextResponse.json({ error: `Максимальный размер файла: ${maxMb} MB.` }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (contentType === "application/pdf" && !Buffer.from(bytes).subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    return NextResponse.json({ error: "Содержимое файла не соответствует PDF." }, { status: 400 });
  }

  let processed;
  try {
    processed = await normalizeProfileUploadImage(folderRaw, bytes, contentType);
  } catch {
    return NextResponse.json({ error: "Файл не является корректным изображением." }, { status: 400 });
  }

  try {
    const url = await uploadToStorage({
      folder: folderRaw,
      bytes: processed?.bytes ?? bytes,
      contentType: processed?.contentType ?? contentType,
      ext: processed?.ext,
      cacheControl: processed ? IMMUTABLE_MEDIA_CACHE_CONTROL : undefined,
    });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload to Supabase Storage failed", error);
    return NextResponse.json({ error: "Не удалось загрузить файл." }, { status: 500 });
  }
}
