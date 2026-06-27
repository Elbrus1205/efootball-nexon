import { NotificationType, ParticipantStatus, TeamInviteStatus, TournamentParticipantMode, TournamentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import { syncTournamentLifecycleStatus, syncTournamentPreviewGroups } from "@/lib/services/tournaments";

export async function POST(request: Request, { params }: { params: { id: string } }) {
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
    select: { id: true, name: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Игрок не найден." }, { status: 404 });
  }

  if (target.id === session.user.id) {
    return NextResponse.json({ error: "Капитан уже находится в составе." }, { status: 400 });
  }

  const activeMembersCount = await db.tournamentRegistrationMember.count({
    where: {
      registrationId: captainMember.registrationId,
      status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
    },
  });

  if (activeMembersCount >= captainMember.tournament.rosterSize) {
    return NextResponse.json({ error: "Состав уже набран." }, { status: 400 });
  }

  const existingMembership = await db.tournamentRegistrationMember.findFirst({
    where: {
      tournamentId: params.id,
      userId: target.id,
    },
    select: { id: true, status: true },
  });

  if (existingMembership?.status === TeamInviteStatus.PENDING || existingMembership?.status === TeamInviteStatus.ACCEPTED) {
    return NextResponse.json({ error: "Игрок уже находится в заявке этого турнира." }, { status: 409 });
  }

  if (existingMembership) {
    await db.tournamentRegistrationMember.update({
      where: { id: existingMembership.id },
      data: {
        registrationId: captainMember.registrationId,
        status: TeamInviteStatus.PENDING,
        isCaptain: false,
        invitedAt: new Date(),
        respondedAt: null,
      },
    });
  } else {
    await db.tournamentRegistrationMember.create({
      data: {
        tournamentId: params.id,
        registrationId: captainMember.registrationId,
        userId: target.id,
        status: TeamInviteStatus.PENDING,
      },
    });
  }

  if (captainMember.tournament.notificationsEnabled) {
    await createNotification({
      userId: target.id,
      title: "Приглашение в состав",
      body: `${captainMember.tournament.title}: капитан приглашает вас в состав.`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${captainMember.tournament.id}`,
      dedupeWithinHours: 1,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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
