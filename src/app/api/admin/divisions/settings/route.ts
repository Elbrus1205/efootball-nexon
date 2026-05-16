import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  await requirePermission("divisions.manage");
  const body = await request.json().catch(() => null);
  const betaEnabled = Boolean(body?.betaEnabled);
  const phaseStartsAt = typeof body?.phaseStartsAt === "string" && body.phaseStartsAt ? new Date(body.phaseStartsAt) : null;
  const phaseEndsAt = typeof body?.phaseEndsAt === "string" && body.phaseEndsAt ? new Date(body.phaseEndsAt) : null;
  const rulesText = typeof body?.rulesText === "string" ? body.rulesText.trim() : null;

  const settings = await db.divisionSettings.upsert({
    where: { id: "default" },
    update: { betaEnabled, phaseStartsAt, phaseEndsAt, rulesText },
    create: { id: "default", betaEnabled, phaseStartsAt, phaseEndsAt, rulesText },
  });

  return NextResponse.json({ settings });
}
