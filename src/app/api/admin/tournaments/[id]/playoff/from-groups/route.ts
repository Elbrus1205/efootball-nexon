import { NextResponse } from "next/server";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { generatePlayoffFromGroups } from "@/lib/services/tournaments";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await requirePermission("tournaments.manageStructure");
  await assertCanManageTournament(session, params.id);

  const bracket = await generatePlayoffFromGroups(params.id);

  return NextResponse.json({ ok: true, bracket });
}
