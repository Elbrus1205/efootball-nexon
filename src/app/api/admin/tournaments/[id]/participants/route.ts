import { NextResponse } from "next/server";
import { ParticipantStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { participantManageSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const participants = await db.tournamentRegistration.findMany({
    where: { tournamentId: params.id },
    include: { user: true, group: true },
    orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ participants });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);
  const body = participantManageSchema.parse(await request.json());

  if (body.action === "add" && body.userId) {
    const registration = await db.tournamentRegistration.create({
      data: {
        tournamentId: params.id,
        userId: body.userId,
        status: ParticipantStatus.CONFIRMED,
        groupId: body.groupId || null,
        seed: body.seed ?? null,
      },
      include: { user: true, group: true },
    });
    return NextResponse.json({ ok: true, registration });
  }

  if (body.action === "remove" && body.registrationId) {
    await db.tournamentRegistration.delete({ where: { id: body.registrationId } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "replace" && body.registrationId && body.replacementUserId) {
    const registration = await db.tournamentRegistration.update({
      where: { id: body.registrationId },
      data: { userId: body.replacementUserId },
      include: { user: true, group: true },
    });
    return NextResponse.json({ ok: true, registration });
  }

  if (body.action === "seed" && body.registrationId) {
    const registration = await db.tournamentRegistration.update({
      where: { id: body.registrationId },
      data: {
        seed: body.seed ?? null,
        groupId: body.groupId || null,
      },
      include: { user: true, group: true },
    });
    return NextResponse.json({ ok: true, registration });
  }

  if (body.action === "status" && body.registrationId && body.status) {
    const registration = await db.tournamentRegistration.update({
      where: { id: body.registrationId },
      data: { status: body.status },
      include: { user: true, group: true },
    });
    return NextResponse.json({ ok: true, registration });
  }

  return NextResponse.json({ error: "Unsupported participant action" }, { status: 400 });
}
