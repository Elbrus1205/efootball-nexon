import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { isDivisionAdminRole, settleDivisionCycle } from "@/lib/services/divisions";

export async function POST() {
  const session = await requireAuth();
  if (!isDivisionAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Режим дивизионов доступен только администраторам." }, { status: 403 });
  }

  try {
    const result = await settleDivisionCycle(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось завершить цикл." }, { status: 400 });
  }
}
