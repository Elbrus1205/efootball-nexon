import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  await requirePermission("divisions.manage");
  const body = await request.json().catch(() => null);
  const betaEnabled = Boolean(body?.betaEnabled);

  const settings = await db.divisionSettings.upsert({
    where: { id: "default" },
    update: { betaEnabled },
    create: { id: "default", betaEnabled },
  });

  return NextResponse.json({ settings });
}
