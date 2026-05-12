import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { normalizeTimeZone, resolveRequestTimeZone } from "@/lib/time-zone";

export async function PATCH(request: Request) {
  const session = await requireAuth();
  const payload = await request.json().catch(() => null);
  const detectedTimeZone = resolveRequestTimeZone(request.headers) ?? normalizeTimeZone(payload?.timeZone);

  if (!detectedTimeZone) {
    return NextResponse.json({ ok: false, error: "Не удалось определить часовой пояс." }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      timeZone: detectedTimeZone,
      timeZoneUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, timeZone: detectedTimeZone });
}
