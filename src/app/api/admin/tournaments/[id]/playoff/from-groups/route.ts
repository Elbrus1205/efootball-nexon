import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { generatePlayoffFromGroups } from "@/lib/services/tournaments";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);

  const bracket = await generatePlayoffFromGroups(params.id);

  return NextResponse.json({ ok: true, bracket });
}
