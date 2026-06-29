import { NextResponse } from "next/server";
import { MatchStatus, NotificationType, ParticipantStatus, TeamInviteStatus } from "@prisma/client";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { createNotification } from "@/lib/services/notifications";
import { formatReliabilityRegistrationRestriction, syncReliabilityRestriction } from "@/lib/services/reliability";
import { recalculateGroupStandings } from "@/lib/services/tournaments";
import { hasTelegramRegistrationContact } from "@/lib/social-links";
import { participantManageSchema } from "@/lib/validators";
import { formatTournamentBanMessage } from "@/lib/user-ban";

const replaceableMatchStatuses = [
  MatchStatus.PENDING,
  MatchStatus.READY,
  MatchStatus.SCHEDULED,
  MatchStatus.LIVE,
  MatchStatus.REJECTED,
];

async function tournamentRequiresTelegram(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { requireTelegramForRegistration: true },
  });

  return Boolean(tournament?.requireTelegramForRegistration);
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await requireAnyPermission(["tournaments.manageParticipants", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);
  await assertCanManageTournament(session, params.id);

  const participants = await db.tournamentRegistration.findMany({
    where: { tournamentId: params.id },
    select: {
      id: true,
      status: true,
      seed: true,
      clubSlug: true,
      clubName: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          publicId: true,
          telegramUsername: true,
        },
      },
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ participants });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requirePermission("tournaments.manageParticipants");
  await assertCanManageTournament(session, params.id);
  const body = participantManageSchema.parse(await request.json());

  if (body.action === "add" && body.userId) {
    const user = await db.user.findUnique({
      where: { id: body.userId },
      select: { isBanned: true, banReason: true, bannedUntil: true, telegramId: true, telegramUsername: true },
    });
    const banMessage = formatTournamentBanMessage(user);

    if (banMessage) {
      return NextResponse.json({ error: banMessage }, { status: 403 });
    }

    const syncedReliability = await syncReliabilityRestriction(body.userId);
    const reliabilityRestriction = formatReliabilityRegistrationRestriction(syncedReliability);
    if (reliabilityRestriction) {
      return NextResponse.json({ error: reliabilityRestriction }, { status: 403 });
    }

    if ((await tournamentRequiresTelegram(params.id)) && !hasTelegramRegistrationContact(user)) {
      return NextResponse.json(
        { error: "Для участия в этом турнире у игрока должен быть привязан Telegram с публичным @username." },
        { status: 403 },
      );
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
    const before = await db.tournamentRegistration.findFirst({ where: { id: body.registrationId, tournamentId: params.id } });

    if (!before) {
      return NextResponse.json({ error: "Участник турнира не найден." }, { status: 404 });
    }

    await db.tournamentRegistration.delete({ where: { id: before.id } });
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
      include: { user: true, group: true, rosterMembers: true },
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
      select: { id: true, name: true, email: true, isBanned: true, banReason: true, bannedUntil: true, telegramId: true, telegramUsername: true },
    });

    if (!replacementUser) {
      return NextResponse.json({ error: "Новый игрок не найден." }, { status: 404 });
    }

    const banMessage = formatTournamentBanMessage(replacementUser);

    if (banMessage) {
      return NextResponse.json({ error: banMessage }, { status: 403 });
    }

    const syncedReliability = await syncReliabilityRestriction(replacementUser.id);
    const reliabilityRestriction = formatReliabilityRegistrationRestriction(syncedReliability);
    if (reliabilityRestriction) {
      return NextResponse.json({ error: reliabilityRestriction }, { status: 403 });
    }

    if ((await tournamentRequiresTelegram(params.id)) && !hasTelegramRegistrationContact(replacementUser)) {
      return NextResponse.json(
        { error: "Для замены в этом турнире у нового игрока должен быть привязан Telegram с публичным @username." },
        { status: 403 },
      );
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
        `Заменён на ${replacementUser.name ?? replacementUser.email ?? replacementUser.id} ${replacedAt.toISOString()}.`,
      ]
        .filter(Boolean)
        .join("\n");

      await tx.tournamentRegistration.update({
        where: { id: before.id },
        data: {
          status: ParticipantStatus.REMOVED,
          seed: null,
          stageSeed: null,
          clubSlug: null,
          clubName: null,
          clubBadgePath: null,
          notes: removedNotes,
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

      await tx.tournamentRegistration.update({
        where: { id: before.id },
        data: {
          notes: [removedNotes, `replacementRegistrationId:${registration.id}`].filter(Boolean).join("\n"),
        },
      });

      // Перенос COOP/командного состава на новую заявку, чтобы участник снова отображался.
      // Напарников (не капитана) переносим как есть, капитаном делаем нового игрока.
      const teammateMemberIds = before.rosterMembers
        .filter((member) => member.userId !== before.userId)
        .map((member) => member.id);

      if (teammateMemberIds.length) {
        await tx.tournamentRegistrationMember.updateMany({
          where: { id: { in: teammateMemberIds } },
          data: { registrationId: registration.id },
        });
      }

      // Убираем старого капитана и любую прошлую запись нового игрока в этом турнире,
      // затем назначаем нового игрока капитаном новой заявки.
      await tx.tournamentRegistrationMember.deleteMany({
        where: {
          tournamentId: params.id,
          OR: [{ registrationId: before.id }, { userId: replacementUserId }],
        },
      });

      await tx.tournamentRegistrationMember.create({
        data: {
          tournamentId: params.id,
          registrationId: registration.id,
          userId: replacementUserId,
          status: TeamInviteStatus.ACCEPTED,
          isCaptain: true,
          respondedAt: replacedAt,
        },
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

  if (body.action === "replaceMember" && body.memberId && body.replacementUserId) {
    const replacementUserId = body.replacementUserId;

    const member = await db.tournamentRegistrationMember.findFirst({
      where: { id: body.memberId, tournamentId: params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        registration: { select: { id: true, status: true, userId: true } },
      },
    });

    if (!member || !member.registration) {
      return NextResponse.json({ error: "Участник состава не найден." }, { status: 404 });
    }

    if (member.registration.status === ParticipantStatus.REMOVED) {
      return NextResponse.json({ error: "Нельзя менять состав удалённой заявки." }, { status: 400 });
    }

    if (member.userId === replacementUserId) {
      return NextResponse.json({ error: "Выберите другого игрока для замены." }, { status: 400 });
    }

    const replacementUser = await db.user.findUnique({
      where: { id: replacementUserId },
      select: { id: true, name: true, email: true, isBanned: true, banReason: true, bannedUntil: true, telegramId: true, telegramUsername: true },
    });

    if (!replacementUser) {
      return NextResponse.json({ error: "Новый игрок не найден." }, { status: 404 });
    }

    const banMessage = formatTournamentBanMessage(replacementUser);
    if (banMessage) {
      return NextResponse.json({ error: banMessage }, { status: 403 });
    }

    const syncedReliability = await syncReliabilityRestriction(replacementUser.id);
    const reliabilityRestriction = formatReliabilityRegistrationRestriction(syncedReliability);
    if (reliabilityRestriction) {
      return NextResponse.json({ error: reliabilityRestriction }, { status: 403 });
    }

    if ((await tournamentRequiresTelegram(params.id)) && !hasTelegramRegistrationContact(replacementUser)) {
      return NextResponse.json(
        { error: "Для замены в этом турнире у нового игрока должен быть привязан Telegram с публичным @username." },
        { status: 403 },
      );
    }

    // Новый игрок не должен уже состоять в этом турнире (как владелец заявки или в любом составе).
    const duplicateMember = await db.tournamentRegistrationMember.findFirst({
      where: {
        tournamentId: params.id,
        userId: replacementUserId,
        status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
      },
      select: { id: true },
    });
    const duplicateRegistration = await db.tournamentRegistration.findFirst({
      where: { tournamentId: params.id, userId: replacementUserId, status: { not: ParticipantStatus.REMOVED } },
      select: { id: true },
    });

    if (duplicateMember || duplicateRegistration) {
      return NextResponse.json({ error: "Этот игрок уже есть в турнире." }, { status: 400 });
    }

    const isCaptain = member.isCaptain || member.userId === member.registration.userId;
    const registrationId = member.registration.id;

    const result = await db.$transaction(async (tx) => {
      await tx.tournamentRegistrationMember.update({
        where: { id: member.id },
        data: {
          userId: replacementUserId,
          status: TeamInviteStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      let replacedMatchesCount = 0;

      // Капитан кооп-заявки одновременно является владельцем заявки и игроком матчей,
      // поэтому при замене капитана переносим владельца заявки и игроков в незавершённых матчах.
      if (isCaptain) {
        await tx.tournamentRegistration.update({
          where: { id: registrationId },
          data: { userId: replacementUserId },
        });

        const replaceableMatches = await tx.match.findMany({
          where: {
            tournamentId: params.id,
            OR: [{ participant1EntryId: registrationId }, { participant2EntryId: registrationId }],
            status: { in: replaceableMatchStatuses },
            player1Score: null,
            player2Score: null,
            winnerId: null,
          },
          select: { id: true, participant1EntryId: true, participant2EntryId: true },
        });

        const playerOneIds = replaceableMatches.filter((m) => m.participant1EntryId === registrationId).map((m) => m.id);
        const playerTwoIds = replaceableMatches.filter((m) => m.participant2EntryId === registrationId).map((m) => m.id);

        if (playerOneIds.length) {
          await tx.match.updateMany({ where: { id: { in: playerOneIds } }, data: { player1Id: replacementUserId } });
        }
        if (playerTwoIds.length) {
          await tx.match.updateMany({ where: { id: { in: playerTwoIds } }, data: { player2Id: replacementUserId } });
        }

        replacedMatchesCount = replaceableMatches.length;
      }

      return { replacedMatchesCount };
    });

    await logAdminAction({
      adminId: session.user.id,
      tournamentId: params.id,
      entityType: "TOURNAMENT_PARTICIPANT",
      entityId: registrationId,
      actionType: "UPDATE",
      beforeJson: { memberId: member.id, previousUserId: member.userId, isCaptain },
      afterJson: { replacementUserId, replacedMatchesCount: result.replacedMatchesCount },
    });

    const tournament = await db.tournament.findUnique({ where: { id: params.id }, select: { title: true, notificationsEnabled: true } });
    if (tournament?.notificationsEnabled) {
      await createNotification({
        userId: replacementUserId,
        title: "Вы добавлены в состав",
        body: `${tournament.title}: администратор включил вас в состав вместо игрока ${member.user.name ?? member.user.email ?? "участника"}.`,
        type: NotificationType.TOURNAMENT,
        link: `/tournaments/${params.id}`,
        dedupeWithinHours: 6,
      });
    }

    return NextResponse.json({ ok: true, replacedMatchesCount: result.replacedMatchesCount });
  }

  if (body.action === "seed" && body.registrationId) {
    const before = await db.tournamentRegistration.findFirst({ where: { id: body.registrationId, tournamentId: params.id } });

    if (!before) {
      return NextResponse.json({ error: "Участник турнира не найден." }, { status: 404 });
    }

    const registration = await db.tournamentRegistration.update({
      where: { id: before.id },
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
    const tournament = await db.tournament.findUnique({ where: { id: params.id }, select: { title: true, notificationsEnabled: true } });
    if (tournament?.notificationsEnabled) {
      await createNotification({
      userId: registration.userId,
      title: "Статус участия изменён",
      body: `${tournament?.title ?? "Турнир"}: ваш статус участника изменён на ${registration.status}.`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${params.id}`,
      dedupeWithinHours: 6,
      });
    }
    return NextResponse.json({ ok: true, registration });
  }

  if (body.action === "status" && body.registrationId && body.status) {
    const before = await db.tournamentRegistration.findFirst({ where: { id: body.registrationId, tournamentId: params.id } });

    if (!before) {
      return NextResponse.json({ error: "Участник турнира не найден." }, { status: 404 });
    }

    const registration = await db.tournamentRegistration.update({
      where: { id: before.id },
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
