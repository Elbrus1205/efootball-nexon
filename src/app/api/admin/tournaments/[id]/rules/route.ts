import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

const rulesSchema = z.object({
  rules: z.string().min(20, "Регламент должен быть не короче 20 символов."),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const parsed = rulesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Не удалось проверить регламент." }, { status: 400 });
  }

  await db.tournament.update({
    where: { id: params.id },
    data: { rules: parsed.data.rules },
  });

  return NextResponse.json({ ok: true });
}
