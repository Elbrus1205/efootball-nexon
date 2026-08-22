import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ensureManagedClubCatalog } from "@/lib/clubs";

export async function GET() {
  await requirePermission("content.manage");
  await ensureManagedClubCatalog();
  const [leagues, clubs] = await Promise.all([
    db.league.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true, badgePath: true, isEnabled: true } }),
    db.club.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, slug: true, name: true, imagePath: true, isRegistrationEnabled: true, isInGameEnabled: true, leagueId: true } }),
  ]);
  return NextResponse.json({ leagues, clubs });
}

export async function PATCH(request: Request) {
  await requirePermission("content.manage");
  const payload = await request.json().catch(() => null) as { id?: unknown; isRegistrationEnabled?: unknown; isInGameEnabled?: unknown } | null;
  if (!payload || typeof payload.id !== "string") return NextResponse.json({ error: "Не указан клуб." }, { status: 400 });
  const data: { isRegistrationEnabled?: boolean; isInGameEnabled?: boolean } = {};
  if (typeof payload.isRegistrationEnabled === "boolean") data.isRegistrationEnabled = payload.isRegistrationEnabled;
  if (typeof payload.isInGameEnabled === "boolean") data.isInGameEnabled = payload.isInGameEnabled;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Не указано изменение." }, { status: 400 });
  const club = await db.club.update({ where: { id: payload.id }, data, select: { id: true, isRegistrationEnabled: true, isInGameEnabled: true } });
  return NextResponse.json({ club });
}
