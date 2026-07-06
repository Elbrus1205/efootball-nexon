"use client";

export type UploadFolder = "avatars" | "banners" | "tournaments" | "divisions" | "faq";

/**
 * Загружает файл на сервер (/api/uploads), который кладёт его в Supabase Storage
 * и возвращает public URL. Бросает Error с понятным сообщением при ошибке.
 */
export async function uploadFile(file: File | Blob, folder: UploadFolder, fileName?: string): Promise<string> {
  const formData = new FormData();
  const named = file instanceof File ? file : new File([file], fileName ?? "upload", { type: file.type });
  formData.append("file", named);
  formData.append("folder", folder);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error || "Не удалось загрузить файл.");
  }

  return payload.url;
}
