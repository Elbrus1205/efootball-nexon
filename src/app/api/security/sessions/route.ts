import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { revokeSecuritySessions } from "@/lib/auth/security";
import { securitySessionSchema } from "@/lib/validators";

export async function DELETE(request: Request) {
  const session = await requireAuth();
  const body = securitySessionSchema.parse(await request.json());

  if (body.revokeAll) {
    await revokeSecuritySessions(session.user.id);

    return NextResponse.json({ ok: true });
  }

  if (!body.authSessionId) {
    return NextResponse.json({ error: "Не выбрана сессия для завершения." }, { status: 400 });
  }

  await revokeSecuritySessions(session.user.id, [body.authSessionId]);

  return NextResponse.json({ ok: true });
}
