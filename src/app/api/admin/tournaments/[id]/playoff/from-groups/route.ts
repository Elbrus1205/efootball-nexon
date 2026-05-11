import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { generatePlayoffFromGroups } from "@/lib/services/tournaments";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await requirePermission("tournaments.manageStructure");

  const bracket = await generatePlayoffFromGroups(params.id);

  return NextResponse.json({ ok: true, bracket });
}
