import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { assertCanManageMatch } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { createNotificationsForUsers } from "@/lib/services/notifications";
import { scheduleUpdateSchema } from "@/lib/validators";
import { syncTournamentBulletin } from "@/lib/services/telegram-publications";
import { invalidateTournamentSchedule } from "@/lib/tournament-cache";

export async function PATCH(request: Request) {
  const session = await requirePermission("schedule.manage");
  const body = scheduleUpdateSchema.parse(await request.json());
  await assertCanManageMatch(session, body.matchId);

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

    if (match.tournament.notificationsEnabled !== false) {
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
    await syncTournamentBulletin(match.tournamentId).catch((error) => console.error("Failed to update Telegram bulletin", error));
    invalidateTournamentSchedule(match.tournamentId);
  }

  return NextResponse.json({ ok: true, schedule });
}
