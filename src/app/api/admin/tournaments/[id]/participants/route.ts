import { NextResponse } from "next/server";
import { MatchStatus, ParticipantStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { recalculateGroupStandings } from "@/lib/services/tournaments";
import { participantManageSchema } from "@/lib/validators";
import { formatTournamentBanMessage } from "@/lib/user-ban";

const replaceableMatchStatuses = [MatchStatus.PENDING, MatchStatus.READY, MatchStatus.SCHEDULED];

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const participants = await db.tournamentRegistration.findMany({
    where: { tournamentId: params.id },
    include: { user: true, group: true },
    orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ participants });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN]);
  const body = participantManageSchema.parse(await request.json());

  if (body.action === "add" && body.userId) {
    const user = await db.user.findUnique({
      where: { id: body.userId },
      select: { isBanned: true, banReason: true, bannedUntil: true },
    });
    const banMessage = formatTournamentBanMessage(user);

    if (banMessage) {
      return NextResponse.json({ error: banMessage }, { status: 403 });
    }

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
    await logAdminAction({
      adminId: session.user.id,
      tournamentId: params.id,
      entityType: "TOURNAMENT_PARTICIPANT",
      entityId: registration.id,
      actionType: "CREATE",
      afterJson: registration,
    });
    return NextResponse.json({ ok: true, registration });
  }

  if (body.action === "remove" && body.registrationId) {
    const before = await db.tournamentRegistration.findUnique({ where: { id: body.registrationId } });
    await db.tournamentRegistration.delete({ where: { id: body.registrationId } });
    await logAdminAction({
      adminId: session.user.id,
      tournamentId: params.id,
      entityType: "TOURNAMENT_PARTICIPANT",
      entityId: body.registrationId,
      actionType: "DELETE",
      beforeJson: before,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "replace" && body.registrationId && body.replacementUserId) {
    const replacementUserId = body.replacementUserId;
    const before = await db.tournamentRegistration.findFirst({
      where: {
        id: body.registrationId,
        tournamentId: params.id,
      },
      include: { user: true, group: true },
    });

    if (!before) {
      return NextResponse.json({ error: "Участник турнира не найден." }, { status: 404 });
    }

    if (before.status === ParticipantStatus.REMOVED) {
      return NextResponse.json({ error: "Нельзя заменить уже удалённого участника." }, { status: 400 });
    }

    if (before.userId === replacementUserId) {
      return NextResponse.json({ error: "Выберите другого игрока для замены." }, { status: 400 });
    }

    const replacementUser = await db.user.findUnique({
      where: { id: replacementUserId },
      select: { id: true, nickname: true, name: true, email: true, isBanned: true, banReason: true, bannedUntil: true },
    });

    if (!replacementUser) {
      return NextResponse.json({ error: "Новый игрок не найден." }, { status: 404 });
    }

    const banMessage = formatTournamentBanMessage(replacementUser);

    if (banMessage) {
      return NextResponse.json({ error: banMessage }, { status: 403 });
    }

    const duplicate = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId: params.id,
        userId: replacementUserId,
      },
    });

    if (duplicate) {
      return NextResponse.json({ error: "Этот игрок уже есть в турнире." }, { status: 400 });
    }

    const replacementResult = await db.$transaction(async (tx) => {
      const replaceableMatches = await tx.match.findMany({
        where: {
          tournamentId: params.id,
          OR: [{ participant1EntryId: before.id }, { participant2EntryId: before.id }],
          status: { in: replaceableMatchStatuses },
          player1Score: null,
          player2Score: null,
          winnerId: null,
        },
        select: {
          id: true,
          participant1EntryId: true,
          participant2EntryId: true,
        },
      });

      const replacedAt = new Date();
      const removedNotes = [
        before.notes?.trim(),
        `Заменён на ${replacementUser.nickname ?? replacementUser.name ?? replacementUser.email ?? replacementUser.id} ${replacedAt.toISOString()}.`,
      ]
        .filter(Boolean)
        .join("\n");

      await tx.tournamentRegistration.update({
        where: { id: before.id },
        data: {
          status: ParticipantStatus.REMOVED,
          groupId: null,
          seed: null,
          stageSeed: null,
          clubSlug: null,
          clubName: null,
          clubBadgePath: null,
          notes: removedNotes,
        },
      });

      await tx.groupStanding.deleteMany({
        where: {
          participantId: before.id,
        },
      });

      const registration = await tx.tournamentRegistration.create({
        data: {
          tournamentId: params.id,
          userId: replacementUserId,
          status: ParticipantStatus.CONFIRMED,
          groupId: before.groupId,
          seed: before.seed,
          stageSeed: before.stageSeed,
          clubSlug: before.clubSlug,
          clubName: before.clubName,
          clubBadgePath: before.clubBadgePath,
          approvedAt: replacedAt,
          checkedInAt: before.checkedInAt,
        },
        include: { user: true, group: true },
      });

      const playerOneMatchIds = replaceableMatches
        .filter((match) => match.participant1EntryId === before.id)
        .map((match) => match.id);
      const playerTwoMatchIds = replaceableMatches
        .filter((match) => match.participant2EntryId === before.id)
        .map((match) => match.id);

      if (playerOneMatchIds.length) {
        await tx.match.updateMany({
          where: { id: { in: playerOneMatchIds } },
          data: {
            participant1EntryId: registration.id,
            player1Id: registration.userId,
          },
        });
      }

      if (playerTwoMatchIds.length) {
        await tx.match.updateMany({
          where: { id: { in: playerTwoMatchIds } },
          data: {
            participant2EntryId: registration.id,
            player2Id: registration.userId,
          },
        });
      }

      if (replaceableMatches.length) {
        await tx.match.updateMany({
          where: {
            id: { in: replaceableMatches.map((match) => match.id) },
            status: MatchStatus.PENDING,
            player1Id: { not: null },
            player2Id: { not: null },
          },
          data: { status: MatchStatus.READY },
        });
      }

      return {
        registration,
        replacedMatchesCount: replaceableMatches.length,
      };
    });

    if (before.groupId) {
      await recalculateGroupStandings(params.id);
    }

    await logAdminAction({
      adminId: session.user.id,
      tournamentId: params.id,
      entityType: "TOURNAMENT_PARTICIPANT",
      entityId: before.id,
      actionType: "UPDATE",
      beforeJson: before,
      afterJson: {
        replacementRegistration: replacementResult.registration,
        replacedMatchesCount: replacementResult.replacedMatchesCount,
      },
    });
    return NextResponse.json({
      ok: true,
      registration: replacementResult.registration,
      replacedMatchesCount: replacementResult.replacedMatchesCount,
    });
  }

  if (body.action === "seed" && body.registrationId) {
    const before = await db.tournamentRegistration.findUnique({ where: { id: body.registrationId } });
    const registration = await db.tournamentRegistration.update({
      where: { id: body.registrationId },
      data: {
        seed: body.seed ?? null,
        groupId: body.groupId || null,
      },
      include: { user: true, group: true },
    });
    await logAdminAction({
      adminId: session.user.id,
      tournamentId: params.id,
      entityType: "TOURNAMENT_SEEDING",
      entityId: registration.id,
      actionType: "UPDATE",
      beforeJson: before,
      afterJson: registration,
    });
    return NextResponse.json({ ok: true, registration });
  }

  if (body.action === "status" && body.registrationId && body.status) {
    const before = await db.tournamentRegistration.findUnique({ where: { id: body.registrationId } });
    const registration = await db.tournamentRegistration.update({
      where: { id: body.registrationId },
      data: { status: body.status },
      include: { user: true, group: true },
    });
    await logAdminAction({
      adminId: session.user.id,
      tournamentId: params.id,
      entityType: "TOURNAMENT_PARTICIPANT_STATUS",
      entityId: registration.id,
      actionType: "UPDATE",
      beforeJson: before,
      afterJson: registration,
    });
    return NextResponse.json({ ok: true, registration });
  }

  return NextResponse.json({ error: "Unsupported participant action" }, { status: 400 });
}
