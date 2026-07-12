import { ClubSelectionMode, NotificationType, ParticipantStatus, TournamentParticipantMode, TournamentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requireAuth } from "@/lib/auth/session";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { hasAcceptedCurrentRegulations } from "@/lib/regulations";
import { formatReliabilityRegistrationRestriction, syncReliabilityRestriction } from "@/lib/services/reliability";
import { createNotification } from "@/lib/services/notifications";
import { getTournamentGroupCapacityLimit, syncTournamentLifecycleStatus, syncTournamentPreviewGroups } from "@/lib/services/tournaments";
import { hasTelegramRegistrationContact } from "@/lib/social-links";
import { formatTournamentBanMessage } from "@/lib/user-ban";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isBanned: true, banReason: true, bannedUntil: true, telegramId: true, telegramUsername: true },
  });
  const banMessage = formatTournamentBanMessage(user);

  if (banMessage) {
    return NextResponse.json({ error: banMessage }, { status: 403 });
  }

  const syncedReliability = await syncReliabilityRestriction(session.user.id);
  const reliabilityRestriction = formatReliabilityRegistrationRestriction(syncedReliability);
  if (reliabilityRestriction) {
    return NextResponse.json({ error: reliabilityRestriction }, { status: 403 });
  }

  const hasAcceptedRegulations = await hasAcceptedCurrentRegulations(session.user.id);
  if (!hasAcceptedRegulations) {
    return NextResponse.json(
      {
        code: "REGULATIONS_ACCEPTANCE_REQUIRED",
        error: "Перед регистрацией нужно прочитать и принять актуальный регламент.",
      },
      { status: 428 },
    );
  }

  await syncTournamentLifecycleStatus(params.id).catch(() => null);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      status: true,
      isTest: true,
      notificationsEnabled: true,
      format: true,
      formatBlueprintJson: true,
      groupsCount: true,
      participantsPerGroup: true,
      maxParticipants: true,
      clubSelectionMode: true,
      participantMode: true,
      rosterSize: true,
      participants: {
        where: { status: { not: "REMOVED" } },
        select: {
          id: true,
          userId: true,
          clubSlug: true,
        },
      },
      rosterMembers: {
        where: { userId: session.user.id, status: { not: "REMOVED" } },
        select: { id: true },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Турнир не найден." }, { status: 404 });
  }

  if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return NextResponse.json({ error: "Регистрация уже закрыта." }, { status: 400 });
  }

  if (tournament.isTest && session.user.role === "PLAYER") {
    return NextResponse.json({ error: "Тестовый турнир доступен только админам." }, { status: 404 });
  }

  if (!hasTelegramRegistrationContact(user)) {
    return NextResponse.json(
      { error: "Для регистрации на этот турнир нужно привязать Telegram с публичным @username в настройках профиля." },
      { status: 403 },
    );
  }

  const groupCapacityLimit = getTournamentGroupCapacityLimit(tournament);
  const registrationLimit = Math.min(tournament.maxParticipants, groupCapacityLimit ?? tournament.maxParticipants);

  if (tournament.participants.length >= registrationLimit) {
    return NextResponse.json({ error: "Лимит участников уже достигнут." }, { status: 400 });
  }

  const existingRegistration = tournament.participants.find((entry) => entry.userId === session.user.id);
  if (existingRegistration || tournament.rosterMembers.length > 0) {
    return NextResponse.json({ error: "Участник уже зарегистрирован в этом турнире." }, { status: 409 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const payload =
    contentType.includes("application/json")
      ? await request.json().catch(() => ({}))
      : Object.fromEntries(await request.formData().catch(async () => new FormData()));

  let clubSlug: string | null = null;
  let clubName: string | null = null;
  let clubBadgePath: string | null = null;
  const teamName = typeof payload.teamName === "string" ? payload.teamName.trim() : "";
  const teamLogo = typeof payload.teamLogo === "string" ? payload.teamLogo.trim() : "";

  if (tournament.participantMode === TournamentParticipantMode.TEAM && teamName.length < 2) {
    return NextResponse.json({ error: "Укажите название команды." }, { status: 400 });
  }

  if (tournament.clubSelectionMode === ClubSelectionMode.PLAYER_PICK) {
    const selectedClubSlug = typeof payload.clubSlug === "string" ? payload.clubSlug : "";
    if (!selectedClubSlug) {
      return NextResponse.json({ error: "Нужно выбрать клуб перед регистрацией." }, { status: 400 });
    }

    const clubs = await getAvailableClubs();
    const selectedClub = clubs.find((club) => club.slug === selectedClubSlug);
    if (!selectedClub) {
      return NextResponse.json({ error: "Выбранный клуб не найден в списке доступных эмблем." }, { status: 400 });
    }

    const takenClub = tournament.participants.find((entry) => entry.clubSlug === selectedClub.slug);
    if (takenClub) {
      return NextResponse.json({ error: "Этот клуб уже занят другим участником." }, { status: 409 });
    }

    clubSlug = selectedClub.slug;
    clubName = selectedClub.name;
    clubBadgePath = selectedClub.imagePath;
  }

  try {
    await db.$transaction(async (tx) => {
      const registration = await tx.tournamentRegistration.create({
        data: {
          tournamentId: params.id,
          userId: session.user.id,
          clubSlug,
          clubName,
          clubBadgePath,
          status: tournament.participantMode === TournamentParticipantMode.SINGLE ? ParticipantStatus.CONFIRMED : ParticipantStatus.PENDING,
          teamName: tournament.participantMode === TournamentParticipantMode.TEAM ? teamName : null,
          teamLogo: tournament.participantMode === TournamentParticipantMode.TEAM ? teamLogo || null : null,
        },
      });

      await tx.tournamentRegistrationMember.create({
        data: {
          tournamentId: params.id,
          registrationId: registration.id,
          userId: session.user.id,
          status: "ACCEPTED",
          isCaptain: true,
          respondedAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Этот клуб уже выбран другим участником." }, { status: 409 });
    }
    throw error;
  }

  await syncTournamentPreviewGroups(params.id).catch(() => null);

  if (tournament.notificationsEnabled) {
    await createNotification({
    userId: session.user.id,
    title: "Вы зарегистрированы",
    body: `${tournament.title}: регистрация подтверждена. Мы сообщим, когда турнир начнётся и появятся матчи.`,
    type: NotificationType.TOURNAMENT,
    link: `/tournaments/${tournament.id}`,
    dedupeWithinHours: 6,
    });
  }

  await syncTournamentLifecycleStatus(params.id);
  revalidatePath(`/tournaments/${params.id}`);
  revalidatePath("/tournaments");

  const origin = getRequestBaseUrl(request);
  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(new URL(`/tournaments/${params.id}`, origin));
}

export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAuth();
  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      status: true,
      notificationsEnabled: true,
      registrationEndsAt: true,
      participants: {
        where: { userId: session.user.id },
        select: { id: true },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Турнир не найден." }, { status: 404 });
  }

  if (tournament.status === TournamentStatus.IN_PROGRESS || tournament.status === TournamentStatus.COMPLETED) {
    return NextResponse.json({ error: "Турнир уже начался или завершён." }, { status: 400 });
  }

  const registration = tournament.participants[0];
  if (!registration) {
    return NextResponse.json({ error: "Вы не зарегистрированы на этот турнир." }, { status: 404 });
  }

  await db.tournamentRegistration.delete({
    where: { id: registration.id },
  });

  if (tournament.notificationsEnabled) {
    await createNotification({
    userId: session.user.id,
    title: "Регистрация отменена",
    body: `${tournament.title}: вы вышли из списка участников турнира.`,
    type: NotificationType.TOURNAMENT,
    link: `/tournaments/${tournament.id}`,
    dedupeWithinHours: 6,
    });
  }

  if (
    (tournament.status === TournamentStatus.REGISTRATION_CLOSED || tournament.status === TournamentStatus.AWAITING_START) &&
    tournament.registrationEndsAt > new Date()
  ) {
    await db.tournament.update({
      where: { id: params.id },
      data: { status: TournamentStatus.REGISTRATION_OPEN, registrationClosedAt: null },
    });
  }

  revalidatePath(`/tournaments/${params.id}`);
  revalidatePath("/tournaments");

  return NextResponse.json({ ok: true });
}
