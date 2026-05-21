import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { clearDivisionSeasons, createDivisionSeason, updateDivisionSeasonAction } from "@/lib/services/divisions";

export async function POST(request: Request) {
  await requirePermission("divisions.manage");
  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "create");

  try {
    if (action === "clear") {
      await clearDivisionSeasons();
      return NextResponse.json({ ok: true });
    }

    if (action === "create") {
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      const startsAt = typeof body?.startsAt === "string" ? new Date(body.startsAt) : null;
      const endsAt = typeof body?.endsAt === "string" ? new Date(body.endsAt) : null;

      if (!name) {
        return NextResponse.json({ error: "Введите название сезона." }, { status: 400 });
      }
      if (!startsAt || Number.isNaN(startsAt.getTime()) || !endsAt || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
        return NextResponse.json({ error: "Введите корректные даты начала и окончания." }, { status: 400 });
      }

      const season = await createDivisionSeason({ name, startsAt, endsAt });
      return NextResponse.json({ season });
    }

    const seasonId = typeof body?.seasonId === "string" ? body.seasonId : "";
    if (!seasonId) {
      return NextResponse.json({ error: "Сезон не найден." }, { status: 400 });
    }

    const season = await updateDivisionSeasonAction(seasonId, action);
    return NextResponse.json({ season });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось обновить сезон." }, { status: 400 });
  }
}
