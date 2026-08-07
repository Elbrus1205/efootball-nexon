import { NotificationType, ParticipantStatus, TeamInviteStatus, TournamentParticipantMode, TournamentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import { buildRosterInviteMessage } from "@/lib/services/telegram-callbacks";
import { syncTournamentLifecycleStatus, syncTournamentPreviewGroups } from "@/lib/services/tournaments";
import { hasTelegramRegistrationContact } from "@/lib/social-links";
import { invalidateTournamentParticipants } from "@/lib/tournament-cache";
import { assertTopRankingRosterEligibility, getRankingSnapshot, TopRankingRosterError } from "@/lib/tournaments/top-ranking-roster";

class RosterInviteWriteError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAuth();
  const payload = await request.json().catch(() => ({}));
  const rawNickname = typeof payload.nickname === "string" ? payload.nickname.trim() : "";
  const nickname = rawNickname.replace(/^@/, "");

  if (nickname.length < 2) {
    return NextResponse.json({ error: "Введите ник игрока." }, { status: 400 });
  }

  const captainMember = await db.tournamentRegistrationMember.findFirst({
    where: {
      tournamentId: params.id,
      userId: session.user.id,
      isCaptain: true,
      status: TeamInviteStatus.ACCEPTED,
    },
    include: {
      registration: true,
      tournament: {
        select: {
          id: true,
          title: true,
          status: true,
          participantMode: true,
          rosterSize: true,
          seasonId: true,
          topRankingRestrictionEnabled: true,
          topRankingLimit: true,
          topRankingPlayerLimit: true,
          notificationsEnabled: true,
        },
      },
    },
  });

  if (!captainMember) {
    return NextResponse.json({ error: "Приглашать игроков может только капитан состава." }, { status: 403 });
  }

  if (captainMember.tournament.participantMode === TournamentParticipantMode.SINGLE) {
    return NextResponse.json({ error: "В одиночном режиме приглашения недоступны." }, { status: 400 });
  }

  if (captainMember.tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return NextResponse.json({ error: "Состав можно менять только до старта турнира." }, { status: 400 });
  }

  const target = await db.user.findFirst({
    where: {
      OR: [
        { name: { equals: rawNickname, mode: "insensitive" } },
        { email: { equals: rawNickname, mode: "insensitive" } },
        { telegramUsername: { equals: nickname, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, telegramId: true, telegramUsername: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
  }

  if (target.id === session.user.id) {
    return NextResponse.json({ error: "Капитан уже находится в составе." }, { status: 400 });
  }

  if (!hasTelegramRegistrationContact(target)) {
    return NextResponse.json(
      { error: "У игрока должен быть привязан Telegram с публичным @username." },
      { status: 400 },
    );
  }

  const rankingSnapshot = await getRankingSnapshot(captainMember.tournament, target.id);

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-roster:${captainMember.registrationId}`}))`;

      const currentCaptain = await tx.tournamentRegistrationMember.findFirst({
        where: {
          id: captainMember.id,
          registrationId: captainMember.registrationId,
          tournamentId: params.id,
          userId: session.user.id,
          isCaptain: true,
          status: TeamInviteStatus.ACCEPTED,
        },
        include: {
          tournament: {
            select: {
              status: true,
              rosterSize: true,
              seasonId: true,
              topRankingRestrictionEnabled: true,
              topRankingLimit: true,
              topRankingPlayerLimit: true,
            },
          },
        },
      });
      if (!currentCaptain) {
        throw new RosterInviteWriteError("Приглашать игроков может только капитан состава.", 403);
      }
      if (currentCaptain.tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
        throw new RosterInviteWriteError("Состав можно менять только до старта турнира.", 400);
      }

      const activeMembersCount = await tx.tournamentRegistrationMember.count({
        where: {
          registrationId: captainMember.registrationId,
          status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
        },
      });
      if (activeMembersCount >= currentCaptain.tournament.rosterSize) {
        throw new RosterInviteWriteError("Состав уже набран.", 400);
      }

      const existingMembership = await tx.tournamentRegistrationMember.findFirst({
        where: { tournamentId: params.id, userId: target.id },
        select: { id: true, status: true },
      });
      if (existingMembership?.status === TeamInviteStatus.PENDING || existingMembership?.status === TeamInviteStatus.ACCEPTED) {
        throw new RosterInviteWriteError("Игрок уже находится в заявке этого турнира.");
      }

      if (existingMembership) {
        await assertTopRankingRosterEligibility(tx, {
          tournament: currentCaptain.tournament,
          registrationId: captainMember.registrationId,
          targetSnapshot: rankingSnapshot,
        });
        await tx.tournamentRegistrationMember.update({
          where: { id: existingMembership.id },
          data: {
            registrationId: captainMember.registrationId,
            status: TeamInviteStatus.PENDING,
            isCaptain: false,
            invitedAt: new Date(),
            respondedAt: null,
            ratingRankAtInvite: rankingSnapshot.rank,
            isTopRankAtInvite: rankingSnapshot.isTopRanked,
          },
        });
      } else {
        await assertTopRankingRosterEligibility(tx, {
          tournament: currentCaptain.tournament,
          registrationId: captainMember.registrationId,
          targetSnapshot: rankingSnapshot,
        });
        await tx.tournamentRegistrationMember.create({
          data: {
            tournamentId: params.id,
            registrationId: captainMember.registrationId,
            userId: target.id,
            status: TeamInviteStatus.PENDING,
            ratingRankAtInvite: rankingSnapshot.rank,
            isTopRankAtInvite: rankingSnapshot.isTopRanked,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof TopRankingRosterError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof RosterInviteWriteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (captainMember.tournament.notificationsEnabled) {
    const baseUrl = getConfiguredSiteBaseUrl();
    const tournamentPath = `/tournaments/${captainMember.tournament.id}`;
    await createNotification({
      userId: target.id,
      title: "Приглашение в состав",
      body: `${captainMember.tournament.title}: капитан приглашает вас в состав.`,
      type: NotificationType.TOURNAMENT,
      link: tournamentPath,
      dedupeWithinHours: 1,
      telegramRichMessage: buildRosterInviteMessage({
        tournamentId: captainMember.tournament.id,
        tournamentTitle: captainMember.tournament.title,
        tournamentUrl: baseUrl ? new URL(tournamentPath, baseUrl).toString() : null,
      }),
    });
  }

  invalidateTournamentParticipants(params.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAuth();
  const payload = await request.json().catch(() => ({}));
  const memberId = typeof payload.memberId === "string" ? payload.memberId : "";

  if (!memberId) {
    return NextResponse.json({ error: "Участник состава не выбран." }, { status: 400 });
  }

  const captainMember = await db.tournamentRegistrationMember.findFirst({
    where: {
      tournamentId: params.id,
      userId: session.user.id,
      isCaptain: true,
      status: TeamInviteStatus.ACCEPTED,
    },
    include: {
      tournament: {
        select: {
          id: true,
          title: true,
          status: true,
          participantMode: true,
          rosterSize: true,
          notificationsEnabled: true,
        },
      },
    },
  });

  if (!captainMember) {
    return NextResponse.json({ error: "Менять состав может только капитан." }, { status: 403 });
  }

  if (captainMember.tournament.participantMode === TournamentParticipantMode.SINGLE) {
    return NextResponse.json({ error: "В одиночном режиме управление составом недоступно." }, { status: 400 });
  }

  if (captainMember.tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return NextResponse.json({ error: "Состав можно менять только до старта турнира." }, { status: 400 });
  }

  const targetMember = await db.tournamentRegistrationMember.findFirst({
    where: {
      id: memberId,
      tournamentId: params.id,
      registrationId: captainMember.registrationId,
      status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  if (!targetMember) {
    return NextResponse.json({ error: "Участник состава не найден." }, { status: 404 });
  }

  if (targetMember.isCaptain || targetMember.userId === session.user.id) {
    return NextResponse.json({ error: "Капитана нельзя удалить из своего состава." }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.tournamentRegistrationMember.update({
      where: { id: targetMember.id },
      data: {
        status: targetMember.status === TeamInviteStatus.PENDING ? TeamInviteStatus.DECLINED : TeamInviteStatus.REMOVED,
        respondedAt: new Date(),
      },
    });

    const acceptedMembersCount = await tx.tournamentRegistrationMember.count({
      where: { registrationId: captainMember.registrationId, status: TeamInviteStatus.ACCEPTED },
    });

    await tx.tournamentRegistration.update({
      where: { id: captainMember.registrationId },
      data: {
        status: acceptedMembersCount >= captainMember.tournament.rosterSize ? ParticipantStatus.CONFIRMED : ParticipantStatus.PENDING,
      },
    });
  });

  invalidateTournamentParticipants(params.id);
  await syncTournamentPreviewGroups(params.id).catch(() => null);
  await syncTournamentLifecycleStatus(params.id).catch(() => null);

  if (captainMember.tournament.notificationsEnabled) {
    await createNotification({
      userId: targetMember.userId,
      title: targetMember.status === TeamInviteStatus.PENDING ? "Приглашение отменено" : "Вы удалены из состава",
      body: `${captainMember.tournament.title}: капитан изменил состав команды.`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${captainMember.tournament.id}`,
      dedupeWithinHours: 1,
    });
  }

  return NextResponse.json({ ok: true });
}
