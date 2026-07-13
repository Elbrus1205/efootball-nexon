import { z } from "zod";

export const lineupPhotoUrlSchema = z
  .string()
  .trim()
  .max(2048, "Ссылка на фото состава слишком длинная.")
  .url("Загрузите корректное фото состава.")
  .refine((value) => value.startsWith("https://") || value.startsWith("http://"), "Загрузите корректное фото состава.");

export const applicationDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z
      .string()
      .trim()
      .min(3, "Укажите причину отказа.")
      .max(500, "Причина отказа не должна превышать 500 символов."),
  }),
]);

export function participantStatusAfterApplicationApproval(participantMode: "SINGLE" | "COOP" | "TEAM") {
  return participantMode === "SINGLE" ? "CONFIRMED" : "PENDING";
}

export function isLineupPhotoStorageUrl(value: string, supabaseUrl?: string | null) {
  if (!supabaseUrl) return false;

  try {
    const imageUrl = new URL(value);
    const storageUrl = new URL(supabaseUrl);
    return (
      imageUrl.origin === storageUrl.origin &&
      imageUrl.pathname.startsWith("/storage/v1/object/public/public-media/lineups/")
    );
  } catch {
    return false;
  }
}
