import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { assignParticipantsToGroups } from "@/lib/services/tournaments";
import { groupAssignmentSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requirePermission("tournaments.manageStructure");

  const body = groupAssignmentSchema.parse(await request.json());
  const groups = await assignParticipantsToGroups(params.id, body);

  return NextResponse.json({ ok: true, groups });
}
