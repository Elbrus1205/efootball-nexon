import { revalidatePath } from "next/cache";
import { NextResponse, after } from "next/server";
import { NotificationType } from "@prisma/client";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { saveRegulationsText } from "@/lib/regulations";
import { createNotificationForAllUsers } from "@/lib/services/notifications";

const regulationsSchema = z.object({
  body: z.string().min(20, "Регламент должен быть не короче 20 символов."),
});

export async function POST(request: Request) {
  await requirePermission("content.manage");

  const parsed = regulationsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Не удалось проверить регламент." }, { status: 400 });
  }

  await saveRegulationsText(parsed.data.body);

  // Обновлённый регламент должен сразу появиться на публичной и админской странице.
  revalidatePath("/regulations");
  revalidatePath("/admin/regulations");

  // Рассылка уведомления всем пользователям не должна задерживать ответ админке —
  // выносим её в фон, чтобы сохранение отвечало мгновенно.
  after(async () => {
    await createNotificationForAllUsers({
      title: "Регламент обновлен",
      body: "На сайте опубликована новая версия регламента. Откройте сайт: во всплывающем окне будут выделены изменения, которые нужно принять.",
      type: NotificationType.SYSTEM,
      link: "/regulations",
    }).catch((error) => {
      console.error("Regulations update notification failed", error);
    });
  });

  return NextResponse.json({ ok: true });
}
