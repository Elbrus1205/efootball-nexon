import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { setBracketSlot } from "@/lib/services/tournaments";
import { bracketSlotSchema } from "@/lib/validators";

export async function POST(request: Request) {
  await requireRole([UserRole.ADMIN]);
  const body = bracketSlotSchema.parse(await request.json());

  const slot = await setBracketSlot(body);

  return NextResponse.json({ ok: true, slot });
}
