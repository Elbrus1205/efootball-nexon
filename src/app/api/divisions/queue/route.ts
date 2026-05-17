import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { enterDivisionQueue, getDivisionSettings, isDivisionAdminRole, leaveDivisionQueue } from "@/lib/services/divisions";

export async function POST() {
  const session = await requireAuth();
  if (!isDivisionAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Режим дивизионов доступен только администраторам." }, { status: 403 });
  }

  const settings = await getDivisionSettings();
  if (!settings.betaEnabled) {
    return NextResponse.json({ error: "Режим временно выключен." }, { status: 403 });
  }

  const result = await enterDivisionQueue(session.user.id);
  return NextResponse.json(result);
}

export async function DELETE() {
  const session = await requireAuth();
  if (!isDivisionAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Режим дивизионов доступен только администраторам." }, { status: 403 });
  }

  await leaveDivisionQueue(session.user.id);
  return NextResponse.json({ ok: true });
}
