import { NextResponse } from "next/server";
import { MatchStatus, NotificationType, ParticipantStatus, Prisma, ReliabilityPenaltyScope, TeamInviteStatus, TournamentParticipantMode } from "@prisma/client";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getAvailableClubs } from "@/lib/clubs";
import { logAdminAction } from "@/lib/services/admin-actions";
import { createNotification } from "@/lib/services/notifications";
import { applyConfiguredReliabilityPenaltyToUsers, formatReliabilityRegistrationRestriction, syncReliabilityRestriction } from "@/lib/services/reliability";
import { getAcceptedRosterPenaltyUserIds, uniqueReliabilityPenaltyUserIds } from "@/lib/services/reliability-penalty-targets";
import { recalculateGroupStandings } from "@/lib/services/tournaments";
import { invalidateTournamentAll } from "@/lib/tournament-cache";
import { hasTelegramRegistrationContact } from "@/lib/social-links";
import { resolveParticipantClub } from "@/lib/tournament-participant-assignment";
import { participantManageSchema } from "@/lib/validators";
import { formatTournamentBanMessage } from "@/lib/user-ban";

const replaceableMatchStatuses: MatchStatus[] = [
  MatchStatus.PENDING,
  MatchStatus.READY,
  MatchStatus.SCHEDULED,
  MatchStatus.LIVE,
  MatchStatus.REJECTED,
];

async function findAbsorbableDuplicateRegistration({
  tournamentId,
  targetRegistrationId,
  userId,
}: {
  tournamentId: string;
  targetRegistrationId: string;
  userId: string;
}) {
  const registration = await db.tournamentRegistration.findFirst({
    where: {
      tournamentId,
      userId,
      id: { not: targetRegistrationId },
      status: { not: ParticipantStatus.REMOVED },
    },
    select: {
      id: true,
      notes: true,
      rosterMembers: {
        where: { status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] } },
        select: { id: true },
      },
    },
  });

  if (!registration) return { registration: null, error: null };

  if (registration.rosterMembers.length) {
    return { registration: null, error: "Этот игрок уже есть в составе другой заявки." };
  }

  const matches = await db.match.findMany({
    where: {
      tournamentId,
      OR: [{ participant1EntryId: registration.id }, { participant2EntryId: registration.id }],
    },
    select: {
      id: true,
      status: true,
      player1Score: true,
      player2Score: true,
      winnerId: true,
    },
  });
  const lockedMatch = matches.find(
    (match) =>
      !replaceableMatchStatuses.includes(match.status) ||
      match.player1Score !== null ||
      match.player2Score !== null ||
      match.winnerId !== null,
  );

  if (lockedMatch) {
    return { registration: null, error: "У этого игрока уже есть сыгранный или закрытый матч, его нельзя перенести в другой состав." };
  }

  return {
    registration: {
      id: registration.id,
      notes: registration.notes,
      matchIds: matches.map((match) => match.id),
    },
    error: null,
  };
}

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const response = await handleParticipantMutation(request, params);
  // Any successful participant mutation (add/remove/replace/roster/edit) can
  // touch participants, standings and match assignments — bust everything for
  // this tournament. Done once here so no individual success branch is missed.
  if (response.status < 400) {
    invalidateTournamentAll(params.id);
  }
  return response;
}

async function handleParticipantMutation(request: Request, params: { id: string }) {
  const session = await requirePermission("tournaments.manageParticipants");
  await assertCanManageTournament(session, params.id);
  const body = participantManageSchema.parse(await request.json());

  if (body.action === "add" && body.userId) {
    const participantUserId = body.userId;
    let clubAssignment;
    try {
      clubAssignment = resolveParticipantClub(body.clubSlug, await getAvailableClubs());
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Выберите клуб участника." }, { status: 400 });
    }

    const [takenClub, selectedGroup] = await Promise.all([
      db.tournamentRegistration.findFirst({
        where: { tournamentId: params.id, clubSlug: clubAssignment.clubSlug, status: { not: ParticipantStatus.REMOVED } },
        select: { id: true },
      }),
      body.groupId
        ? db.tournamentGroup.findFirst({ where: { id: body.groupId, stage: { tournamentId: params.id } }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (takenClub) {
      return NextResponse.json({ error: "Этот клуб уже занят другим участником." }, { status: 409 });
    }
    if (body.groupId && !selectedGroup) {
      return NextResponse.json({ error: "Выбранная группа не относится к этому турниру." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: participantUserId },
      select: { isBanned: true, banReason: true, bannedUntil: true, telegramId: true, telegramUsername: true },
    });
    const banMessage = formatTournamentBanMessage(user);

    if (banMessage) {
      return NextResponse.json({ error: banMessage }, { status: 403 });
    }

    const syncedReliability = await syncReliabilityRestriction(participantUserId);
    const reliabilityRestriction = formatReliabilityRegistrationRestriction(syncedReliability);
    if (reliabilityRestriction) {
      return NextResponse.json({ error: reliabilityRestriction }, { status: 403 });
    }

    if (!hasTelegramRegistrationContact(user)) {
      return NextResponse.json(
        { error: "Для участия в этом турнире у игрока должен быть привязан Telegram с публичным @username." },
        { status: 403 },
      );
    }

    let registration;
    try {
      registration = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-registration:${params.id}`}))`;
        const conflictingRegistration = await tx.tournamentRegistration.findFirst({
          where: {
            tournamentId: params.id,
            status: { not: ParticipantStatus.REMOVED },
            OR: [{ userId: participantUserId }, { clubSlug: clubAssignment.clubSlug }],
          },
          select: { userId: true, clubSlug: true },
        });
        if (conflictingRegistration?.userId === participantUserId) throw new Error("PARTICIPANT_ALREADY_EXISTS");
        if (conflictingRegistration?.clubSlug === clubAssignment.clubSlug) throw new Error("CLUB_ALREADY_TAKEN");

        return tx.tournamentRegistration.create({
          data: {
            tournamentId: params.id,
            userId: participantUserId,
            status: ParticipantStatus.CONFIRMED,
            groupId: body.groupId || null,
            seed: body.seed ?? null,
            ...clubAssignment,
          },
          include: { user: true, group: true },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PARTICIPANT_ALREADY_EXISTS") {
        return NextResponse.json({ error: "Этот игрок уже есть в турнире." }, { status: 409 });
      }
      if (error instanceof Error && error.message === "CLUB_ALREADY_TAKEN") {
        return NextResponse.json({ error: "Этот клуб уже занят другим участником." }, { status: 409 });
      }
      throw error;
    }
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

    try {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-registration:${params.id}`}))`;
        const removed = await tx.tournamentRegistration.deleteMany({
          where: { id: before.id, tournamentId: params.id },
        });
        if (removed.count !== 1) throw new Error("PARTICIPANT_ALREADY_REMOVED");
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PARTICIPANT_ALREADY_REMOVED") {
        return NextResponse.json({ error: "Участник уже удалён." }, { status: 409 });
      }
      throw error;
    }
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

    let clubAssignment;
    try {
      clubAssignment = resolveParticipantClub(body.clubSlug, await getAvailableClubs());
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Выберите клуб участника." }, { status: 400 });
    }

    const takenClub = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId: params.id,
        id: { not: before.id },
        clubSlug: clubAssignment.clubSlug,
        status: { not: ParticipantStatus.REMOVED },
      },
      select: { id: true },
    });
    if (takenClub) {
      return NextResponse.json({ error: "Этот клуб уже занят другим участником." }, { status: 409 });
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

    if (!hasTelegramRegistrationContact(replacementUser)) {
      return NextResponse.json(
        { error: "Для замены в этом турнире у нового игрока должен быть привязан Telegram с публичным @username." },
        { status: 403 },
      );
    }

    const duplicate = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId: params.id,
        userId: replacementUserId,
        status: { not: ParticipantStatus.REMOVED },
      },
    });

    if (duplicate) {
      return NextResponse.json({ error: "Этот игрок уже есть в турнире." }, { status: 400 });
    }

    let replacementResult;
    try {
      replacementResult = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-registration:${params.id}`}))`;
      const lockedBefore = await tx.tournamentRegistration.findFirst({
        where: { id: before.id, tournamentId: params.id },
        include: { user: true, group: true, rosterMembers: true },
      });
      if (!lockedBefore || lockedBefore.status === ParticipantStatus.REMOVED) {
        throw new Error("PARTICIPANT_NOT_REPLACEABLE");
      }
      if (lockedBefore.userId === replacementUserId) throw new Error("REPLACEMENT_IS_SAME_USER");

      const lockedConflict = await tx.tournamentRegistration.findFirst({
        where: {
          tournamentId: params.id,
          id: { not: lockedBefore.id },
          status: { not: ParticipantStatus.REMOVED },
          OR: [{ userId: replacementUserId }, { clubSlug: clubAssignment.clubSlug }],
        },
        select: { userId: true, clubSlug: true },
      });
      if (lockedConflict?.userId === replacementUserId) throw new Error("REPLACEMENT_ALREADY_REGISTERED");
      if (lockedConflict?.clubSlug === clubAssignment.clubSlug) throw new Error("CLUB_ALREADY_TAKEN");

      const replaceableMatches = await tx.match.findMany({
        where: {
          tournamentId: params.id,
          OR: [{ participant1EntryId: lockedBefore.id }, { participant2EntryId: lockedBefore.id }],
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
        lockedBefore.notes?.trim(),
        `Заменён на ${replacementUser.name ?? replacementUser.email ?? replacementUser.id} ${replacedAt.toISOString()}.`,
      ]
        .filter(Boolean)
        .join("\n");

      await tx.tournamentRegistration.update({
        where: { id: lockedBefore.id },
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
          groupId: lockedBefore.groupId,
          seed: lockedBefore.seed,
          stageSeed: lockedBefore.stageSeed,
          ...clubAssignment,
          approvedAt: replacedAt,
          checkedInAt: lockedBefore.checkedInAt,
        },
        include: { user: true, group: true },
      });

      await tx.tournamentRegistration.update({
        where: { id: lockedBefore.id },
        data: {
          notes: [removedNotes, `replacementRegistrationId:${registration.id}`].filter(Boolean).join("\n"),
        },
      });

      // Перенос COOP/командного состава на новую заявку, чтобы участник снова отображался.
      // Напарников (не капитана) переносим как есть, капитаном делаем нового игрока.
      const teammateMemberIds = lockedBefore.rosterMembers
        .filter((member) => member.userId !== lockedBefore.userId)
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
          OR: [{ registrationId: lockedBefore.id }, { userId: replacementUserId }],
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
        .filter((match) => match.participant1EntryId === lockedBefore.id)
        .map((match) => match.id);
      const playerTwoMatchIds = replaceableMatches
        .filter((match) => match.participant2EntryId === lockedBefore.id)
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
        before: lockedBefore,
        registration,
        replacedMatchesCount: replaceableMatches.length,
      };
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PARTICIPANT_NOT_REPLACEABLE") {
        return NextResponse.json({ error: "Участник уже удалён или заменён." }, { status: 409 });
      }
      if (error instanceof Error && error.message === "REPLACEMENT_IS_SAME_USER") {
        return NextResponse.json({ error: "Выберите другого игрока для замены." }, { status: 409 });
      }
      if (error instanceof Error && error.message === "REPLACEMENT_ALREADY_REGISTERED") {
        return NextResponse.json({ error: "Этот игрок уже есть в турнире." }, { status: 409 });
      }
      if (error instanceof Error && error.message === "CLUB_ALREADY_TAKEN") {
        return NextResponse.json({ error: "Этот клуб уже занят другим участником." }, { status: 409 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2025"].includes(error.code)) {
        return NextResponse.json({ error: "Данные участника уже изменены другим запросом." }, { status: 409 });
      }
      throw error;
    }

    if (replacementResult.before.groupId) {
      await recalculateGroupStandings(params.id);
    }

    if (body.reliabilityPenaltyReasonId) {
      try {
        const penaltyUserIds = getAcceptedRosterPenaltyUserIds(replacementResult.before);

        await applyConfiguredReliabilityPenaltyToUsers({
          reasonId: body.reliabilityPenaltyReasonId,
          scope: ReliabilityPenaltyScope.PLAYER_REPLACEMENT,
          userIds: penaltyUserIds,
          actorId: session.user.id,
          tournamentId: params.id,
          dedupeKeyForUserId: () => `replacement:${replacementResult.before.id}:${replacementUserId}:${body.reliabilityPenaltyReasonId}`,
          comment: `Игрок заменен на ${replacementUser.name ?? replacementUser.email ?? replacementUser.id}.`,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "RELIABILITY_PENALTY_REASON_NOT_FOUND") {
          return NextResponse.json({ error: "Выбранный штраф надежности больше недоступен." }, { status: 400 });
        }
        throw error;
      }
    }

    await logAdminAction({
      adminId: session.user.id,
      tournamentId: params.id,
      entityType: "TOURNAMENT_PARTICIPANT",
      entityId: replacementResult.before.id,
      actionType: "UPDATE",
      beforeJson: replacementResult.before,
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
        registration: {
          select: {
            id: true,
            status: true,
            userId: true,
            rosterMembers: {
              where: { status: TeamInviteStatus.ACCEPTED },
              select: { userId: true, status: true },
            },
          },
        },
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

    let clubAssignment;
    try {
      clubAssignment = resolveParticipantClub(body.clubSlug, await getAvailableClubs());
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Выберите клуб участника." }, { status: 400 });
    }

    const takenClub = await db.tournamentRegistration.findFirst({
      where: {
        tournamentId: params.id,
        id: { not: member.registration.id },
        clubSlug: clubAssignment.clubSlug,
        status: { not: ParticipantStatus.REMOVED },
      },
      select: { id: true },
    });
    if (takenClub) {
      return NextResponse.json({ error: "Этот клуб уже занят другим участником." }, { status: 409 });
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

    if (!hasTelegramRegistrationContact(replacementUser)) {
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
        registration: { status: { not: ParticipantStatus.REMOVED } },
      },
      select: { id: true },
    });
    const duplicateRegistrationAbsorption = await findAbsorbableDuplicateRegistration({
      tournamentId: params.id,
      targetRegistrationId: member.registration.id,
      userId: replacementUserId,
    });

    if (duplicateMember || duplicateRegistrationAbsorption.error) {
      return NextResponse.json({ error: duplicateRegistrationAbsorption.error ?? "Этот игрок уже есть в турнире." }, { status: 400 });
    }

    const isCaptain = member.isCaptain || member.userId === member.registration.userId;
    const registrationId = member.registration.id;

    const result = await db.$transaction(async (tx) => {
      if (duplicateRegistrationAbsorption.registration) {
        const absorbedAt = new Date();
        const removedNotes = [
          duplicateRegistrationAbsorption.registration.notes?.trim(),
          `Перенесён в состав заявки ${registrationId} ${absorbedAt.toISOString()}.`,
        ]
          .filter(Boolean)
          .join("\n");

        await tx.tournamentRegistration.update({
          where: { id: duplicateRegistrationAbsorption.registration.id },
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

        if (duplicateRegistrationAbsorption.registration.matchIds.length) {
          await tx.match.updateMany({
            where: { id: { in: duplicateRegistrationAbsorption.registration.matchIds } },
            data: { status: MatchStatus.CANCELLED },
          });
        }
      }

      await tx.tournamentRegistrationMember.deleteMany({
        where: {
          tournamentId: params.id,
          userId: replacementUserId,
          id: { not: member.id },
          status: { notIn: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
        },
      });

      await tx.tournamentRegistrationMember.update({
        where: { id: member.id },
        data: {
          userId: replacementUserId,
          status: TeamInviteStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      let replacedMatchesCount = 0;

      // Капитан кооп-заявки одновременно является владельцем заявки.
      if (isCaptain) {
        await tx.tournamentRegistration.update({
          where: { id: registrationId },
          data: { userId: replacementUserId },
        });
      }

      // Переносим только те открытые матчи, где заменяемый участник был реально назначен.
      // Иначе пустой слот капитана становится наполовину заполненным и его пропускают
      // как ручное назначение, так и автоматический подбор.
      const replaceableMatches = await tx.match.findMany({
        where: {
          tournamentId: params.id,
          OR: [
            { participant1EntryId: registrationId, player1Id: member.userId },
            { participant2EntryId: registrationId, player2Id: member.userId },
          ],
          status: { in: replaceableMatchStatuses },
          player1Score: null,
          player2Score: null,
          winnerId: null,
        },
        select: { id: true, participant1EntryId: true, participant2EntryId: true },
      });

      const playerOneIds = replaceableMatches.filter((match) => match.participant1EntryId === registrationId).map((match) => match.id);
      const playerTwoIds = replaceableMatches.filter((match) => match.participant2EntryId === registrationId).map((match) => match.id);

      if (playerOneIds.length) {
        await tx.match.updateMany({ where: { id: { in: playerOneIds } }, data: { player1Id: replacementUserId } });
      }
      if (playerTwoIds.length) {
        await tx.match.updateMany({ where: { id: { in: playerTwoIds } }, data: { player2Id: replacementUserId } });
      }

      replacedMatchesCount = replaceableMatches.length;

      await tx.tournamentRegistration.update({
        where: { id: registrationId },
        data: { ...clubAssignment },
      });

      return { replacedMatchesCount };
    });

    if (body.reliabilityPenaltyReasonId) {
      try {
        const penaltyUserIds = uniqueReliabilityPenaltyUserIds([member.userId, ...getAcceptedRosterPenaltyUserIds(member.registration)]);

        await applyConfiguredReliabilityPenaltyToUsers({
          reasonId: body.reliabilityPenaltyReasonId,
          scope: ReliabilityPenaltyScope.PLAYER_REPLACEMENT,
          userIds: penaltyUserIds,
          actorId: session.user.id,
          tournamentId: params.id,
          dedupeKeyForUserId: () => `replacement-member:${member.id}:${member.userId}:${replacementUserId}:${body.reliabilityPenaltyReasonId}`,
          comment: `Игрок состава заменен на ${replacementUser.name ?? replacementUser.email ?? replacementUser.id}.`,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "RELIABILITY_PENALTY_REASON_NOT_FOUND") {
          return NextResponse.json({ error: "Выбранный штраф надежности больше недоступен." }, { status: 400 });
        }
        throw error;
      }
    }

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

  if (body.action === "addMember" && body.registrationId && body.replacementUserId) {
    const replacementUserId = body.replacementUserId;

    const registration = await db.tournamentRegistration.findFirst({
      where: { id: body.registrationId, tournamentId: params.id },
      include: {
        tournament: { select: { title: true, participantMode: true, rosterSize: true, notificationsEnabled: true } },
        rosterMembers: { where: { status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] } }, select: { id: true, userId: true } },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Заявка турнира не найдена." }, { status: 404 });
    }

    if (registration.status === ParticipantStatus.REMOVED) {
      return NextResponse.json({ error: "Нельзя добавлять игрока в удалённую заявку." }, { status: 400 });
    }

    if (registration.tournament.participantMode === TournamentParticipantMode.SINGLE) {
      return NextResponse.json({ error: "В одиночном турнире нет состава для добавления игрока." }, { status: 400 });
    }

    if (registration.rosterMembers.length >= registration.tournament.rosterSize) {
      return NextResponse.json({ error: "Состав уже заполнен." }, { status: 400 });
    }

    if (registration.rosterMembers.some((member) => member.userId === replacementUserId)) {
      return NextResponse.json({ error: "Этот игрок уже есть в составе." }, { status: 400 });
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

    if (!hasTelegramRegistrationContact(replacementUser)) {
      return NextResponse.json(
        { error: "Для добавления в этот турнир у нового игрока должен быть привязан Telegram с публичным @username." },
        { status: 403 },
      );
    }

    const duplicateMember = await db.tournamentRegistrationMember.findFirst({
      where: {
        tournamentId: params.id,
        userId: replacementUserId,
        status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
        registration: { status: { not: ParticipantStatus.REMOVED } },
      },
      select: { id: true },
    });
    const duplicateRegistrationAbsorption = await findAbsorbableDuplicateRegistration({
      tournamentId: params.id,
      targetRegistrationId: registration.id,
      userId: replacementUserId,
    });

    if (duplicateMember || duplicateRegistrationAbsorption.error) {
      return NextResponse.json({ error: duplicateRegistrationAbsorption.error ?? "Этот игрок уже есть в турнире." }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      if (duplicateRegistrationAbsorption.registration) {
        const absorbedAt = new Date();
        const removedNotes = [
          duplicateRegistrationAbsorption.registration.notes?.trim(),
          `Перенесён в состав заявки ${registration.id} ${absorbedAt.toISOString()}.`,
        ]
          .filter(Boolean)
          .join("\n");

        await tx.tournamentRegistration.update({
          where: { id: duplicateRegistrationAbsorption.registration.id },
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

        if (duplicateRegistrationAbsorption.registration.matchIds.length) {
          await tx.match.updateMany({
            where: { id: { in: duplicateRegistrationAbsorption.registration.matchIds } },
            data: { status: MatchStatus.CANCELLED },
          });
        }
      }

      await tx.tournamentRegistrationMember.deleteMany({
        where: {
          tournamentId: params.id,
          userId: replacementUserId,
          status: { notIn: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
        },
      });

      const member = await tx.tournamentRegistrationMember.create({
        data: {
          tournamentId: params.id,
          registrationId: registration.id,
          userId: replacementUserId,
          status: TeamInviteStatus.ACCEPTED,
          isCaptain: replacementUserId === registration.userId,
          respondedAt: new Date(),
        },
      });

      const nextActiveMembersCount = registration.rosterMembers.length + 1;
      if (nextActiveMembersCount >= registration.tournament.rosterSize && registration.status === ParticipantStatus.PENDING) {
        await tx.tournamentRegistration.update({
          where: { id: registration.id },
          data: { status: ParticipantStatus.CONFIRMED },
        });
      }

      return { member, nextActiveMembersCount };
    });

    await logAdminAction({
      adminId: session.user.id,
      tournamentId: params.id,
      entityType: "TOURNAMENT_PARTICIPANT",
      entityId: registration.id,
      actionType: "UPDATE",
      beforeJson: { registrationId: registration.id, activeMembersCount: registration.rosterMembers.length },
      afterJson: { addedMemberId: result.member.id, replacementUserId, activeMembersCount: result.nextActiveMembersCount },
    });

    if (registration.tournament.notificationsEnabled) {
      await createNotification({
        userId: replacementUserId,
        title: "Вы добавлены в состав",
        body: `${registration.tournament.title}: администратор добавил вас в состав турнира.`,
        type: NotificationType.TOURNAMENT,
        link: `/tournaments/${params.id}`,
        dedupeWithinHours: 6,
      });
    }

    return NextResponse.json({ ok: true, member: result.member });
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
