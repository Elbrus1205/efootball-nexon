import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { enterDivisionQueue, getDivisionSettings, leaveDivisionQueue } from "@/lib/services/divisions";

export async function POST() {
  const session = await requireAuth();
  const settings = await getDivisionSettings();
  if (!settings.betaEnabled) {
    return NextResponse.json({ error: "Режим временно выключен." }, { status: 403 });
  }

  const result = await enterDivisionQueue(session.user.id);
  return NextResponse.json(result);
}

export async function DELETE() {
  const session = await requireAuth();
  await leaveDivisionQueue(session.user.id);
  return NextResponse.json({ ok: true });
}
