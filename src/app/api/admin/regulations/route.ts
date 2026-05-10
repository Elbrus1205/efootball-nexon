import { NextResponse } from "next/server";
import { NotificationType, UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { saveRegulationsText } from "@/lib/regulations";
import { createNotificationForAllUsers } from "@/lib/services/notifications";

const regulationsSchema = z.object({
  body: z.string().min(20, "Регламент должен быть не короче 20 символов."),
});

export async function POST(request: Request) {
  await requireRole([UserRole.FOUNDER, UserRole.ORGANIZER, UserRole.ADMIN, UserRole.JUDGE]);

  const parsed = regulationsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Не удалось проверить регламент." }, { status: 400 });
  }

  await saveRegulationsText(parsed.data.body);
  await createNotificationForAllUsers({
    title: "Регламент обновлён",
    body: "На сайте опубликована новая версия регламента. Проверьте правила перед матчами и регистрацией.",
    type: NotificationType.SYSTEM,
    link: "/regulations",
    dedupeWithinHours: 6,
  });

  return NextResponse.json({ ok: true });
}
