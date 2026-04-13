import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { saveRegulationsText } from "@/lib/regulations";

const regulationsSchema = z.object({
  body: z.string().min(20, "Регламент должен быть не короче 20 символов."),
});

export async function POST(request: Request) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const parsed = regulationsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Не удалось проверить регламент." }, { status: 400 });
  }

  await saveRegulationsText(parsed.data.body);

  return NextResponse.json({ ok: true });
}
