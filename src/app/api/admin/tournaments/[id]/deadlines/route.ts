import { AdminActionType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { notifyActiveTournamentRoundsStarted } from "@/lib/services/tournaments";
import { roundDeadlineSchema } from "@/lib/validators";

const staffRoles = [UserRole.FOUNDER, UserRole.ORGANIZER, UserRole.ADMIN, UserRole.JUDGE];
const datetimeLocalPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function parseDeadlineDate(value: string) {
  const trimmed = value.trim();
  const localMatch = datetimeLocalPattern.exec(trimmed);

  if (localMatch) {
    const [, year, month, day, hour, minute, second = "0"] = localMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 3, Number(minute), Number(second)));
  }

  return new Date(trimmed);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole(staffRoles);
  const parsed = roundDeadlineSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Некорректный дедлайн." }, { status: 400 });
  }

  const { stageId, round, deadlineAt } = parsed.data;
  const stage = await db.tournamentStage.findFirst({
    where: {
      id: stageId,
      tournamentId: params.id,
    },
    include: {
      matches: {
        select: { round: true },
      },
    },
  });

  if (!stage) {
    return NextResponse.json({ error: "Этап турнира не найден." }, { status: 404 });
  }

  const maxRoundFromMatches = stage.matches.reduce((max, match) => Math.max(max, match.round), 0);
  const maxRound = Math.max(stage.roundsCount ?? 0, maxRoundFromMatches);

  if (maxRound > 0 && round > maxRound) {
    return NextResponse.json({ error: `Для этого этапа доступно только ${maxRound} туров/раундов.` }, { status: 400 });
  }

  const before = await db.roundDeadline.findUnique({
    where: {
      stageId_round: {
        stageId,
        round,
      },
    },
  });

  if (!deadlineAt) {
    await db.roundDeadline.deleteMany({
      where: {
        tournamentId: params.id,
        stageId,
        round,
      },
    });

    if (before) {
      await logAdminAction({
        adminId: session.user.id,
        tournamentId: params.id,
        entityType: "ROUND_DEADLINE",
        entityId: before.id,
        actionType: AdminActionType.DELETE,
        beforeJson: before,
      });
    }

    return NextResponse.json({ ok: true, deadline: null });
  }

  const date = parseDeadlineDate(deadlineAt);

  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Укажите корректную дату дедлайна." }, { status: 400 });
  }

  const deadline = await db.roundDeadline.upsert({
    where: {
      stageId_round: {
        stageId,
        round,
      },
    },
    update: {
      deadlineAt: date,
    },
    create: {
      tournamentId: params.id,
      stageId,
      round,
      deadlineAt: date,
    },
  });

  await logAdminAction({
    adminId: session.user.id,
    tournamentId: params.id,
    entityType: "ROUND_DEADLINE",
    entityId: deadline.id,
    actionType: before ? AdminActionType.UPDATE : AdminActionType.CREATE,
    beforeJson: before,
    afterJson: deadline,
  });

  await notifyActiveTournamentRoundsStarted(params.id);

  return NextResponse.json({ ok: true, deadline });
}
