import { NextResponse } from "next/server";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { assignParticipantsToGroups } from "@/lib/services/tournaments";
import { syncTournamentBulletin } from "@/lib/services/telegram-publications";
import { groupAssignmentSchema } from "@/lib/validators";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.manageStructure");
  await assertCanManageTournament(session, params.id);

  const body = groupAssignmentSchema.parse(await request.json());
  const groups = await assignParticipantsToGroups(params.id, body);
  await syncTournamentBulletin(params.id).catch((error) => console.error("Failed to update Telegram bulletin", error));

  return NextResponse.json({ ok: true, groups });
}
