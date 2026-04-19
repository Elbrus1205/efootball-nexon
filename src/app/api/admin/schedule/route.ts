import { NextResponse } from "next/server";
import { NotificationType, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { createNotificationsForUsers } from "@/lib/services/notifications";
import { scheduleUpdateSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  const session = await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);
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

  const match = await db.match.findUnique({
    where: { id: body.matchId },
    include: { tournament: true },
  });
  if (match) {
    await logAdminAction({
      adminId: session.user.id,
      tournamentId: match.tournamentId,
      entityType: "MATCH_SCHEDULE",
      entityId: body.matchId,
      actionType: "RESCHEDULE",
      afterJson: schedule,
    });

    await createNotificationsForUsers({
      userIds: [match.player1Id, match.player2Id].filter(Boolean) as string[],
      title: existing ? "Матч перенесён" : "Матч запланирован",
      body: `${match.tournament.title}: матч назначен на ${new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(schedule.startsAt)}.`,
      type: NotificationType.MATCH,
      link: `/tournaments/${match.tournamentId}`,
      dedupeWithinHours: 3,
    });
  }

  return NextResponse.json({ ok: true, schedule });
}
