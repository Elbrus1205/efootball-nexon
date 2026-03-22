import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { scheduleUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);
  const body = scheduleUpdateSchema.parse(await request.json());

  const existing = await db.matchSchedule.findFirst({
    where: { matchId: body.matchId },
  });

  const schedule = existing
    ? await db.matchSchedule.update({
        where: { id: existing.id },
        data: {
          startsAt: new Date(body.startsAt),
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          slotLabel: body.slotLabel || null,
          timezone: body.timezone || "Europe/Moscow",
        },
      })
    : await db.matchSchedule.create({
        data: {
          matchId: body.matchId,
          startsAt: new Date(body.startsAt),
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          slotLabel: body.slotLabel || null,
          timezone: body.timezone || "Europe/Moscow",
        },
      });

  await db.match.update({
    where: { id: body.matchId },
    data: {
      scheduledAt: new Date(body.startsAt),
      status: "SCHEDULED",
    },
  });

  return NextResponse.json({ ok: true, schedule });
}
