import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requirePermission("divisions.manage");
  const body = await request.json().catch(() => null);
  const division = Number(body?.division);
  const points = Number(body?.points);
  const ratingValue = body?.rating === "" || body?.rating === null || body?.rating === undefined ? null : Number(body.rating);

  if (!Number.isInteger(division) || division < 1 || division > 5) {
    return NextResponse.json({ error: "Дивизион должен быть от 1 до 5." }, { status: 400 });
  }
  if (!Number.isInteger(points) || points < 0) {
    return NextResponse.json({ error: "Очки должны быть положительным числом." }, { status: 400 });
  }
  if (ratingValue !== null && (!Number.isInteger(ratingValue) || ratingValue < 0)) {
    return NextResponse.json({ error: "Рейтинг должен быть положительным числом." }, { status: 400 });
  }

  const player = await db.divisionPlayer.update({
    where: { userId: params.id },
    data: {
      division,
      points,
      rating: division <= 2 ? ratingValue ?? 1000 : null,
    },
  });

  return NextResponse.json({ player });
}
