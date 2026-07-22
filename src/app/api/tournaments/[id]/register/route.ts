import { ClubSelectionMode, NotificationType, ParticipantStatus, TeamInviteStatus, TournamentApplicationStatus, TournamentParticipantMode, TournamentStatus } from "@prisma/client";
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
import { getTournamentGroupCapacityLimit, syncTournamentPreviewGroups } from "@/lib/services/tournaments";
import { hasTelegramRegistrationContact } from "@/lib/social-links";
import { isLineupPhotoStorageUrl, lineupPhotoUrlSchema } from "@/lib/tournament-applications";
import { formatTournamentBanMessage } from "@/lib/user-ban";

class RegistrationWriteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

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
      requireLineupPhoto: true,
      participants: {
        where: { status: { notIn: ["REMOVED", "REJECTED"] } },
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
      registrationApplications: {
        where: {
          OR: [
            { userId: session.user.id },
            { status: TournamentApplicationStatus.PENDING },
          ],
        },
        select: { id: true, userId: true, status: true, clubSlug: true },
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
  const lineupPhotoUrl = typeof payload.lineupPhotoUrl === "string" ? payload.lineupPhotoUrl.trim() : "";

  if (tournament.requireLineupPhoto) {
    const photoResult = lineupPhotoUrlSchema.safeParse(lineupPhotoUrl);
    if (!photoResult.success) {
      return NextResponse.json({ error: photoResult.error.issues[0]?.message ?? "Прикрепите фото состава." }, { status: 400 });
    }
    if (!isLineupPhotoStorageUrl(photoResult.data, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      return NextResponse.json({ error: "Фото состава должно быть загружено через форму турнира." }, { status: 400 });
    }

    const existingApplication = tournament.registrationApplications.find((application) => application.userId === session.user.id);
    if (existingApplication?.status === TournamentApplicationStatus.PENDING) {
      return NextResponse.json({ error: "Ваша заявка уже находится на проверке." }, { status: 409 });
    }
  }

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
    const reservedByApplication = tournament.registrationApplications.find(
      (application) =>
        application.userId !== session.user.id &&
        application.status === TournamentApplicationStatus.PENDING &&
        application.clubSlug === selectedClub.slug,
    );
    if (takenClub || reservedByApplication) {
      return NextResponse.json({ error: "Этот клуб уже занят другим участником." }, { status: 409 });
    }

    clubSlug = selectedClub.slug;
    clubName = selectedClub.name;
    clubBadgePath = selectedClub.imagePath;
  }

  if (tournament.requireLineupPhoto) {
    try {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-registration:${params.id}`}))`;
        const current = await tx.tournament.findUnique({
          where: { id: params.id },
          select: {
            status: true,
            maxParticipants: true,
            format: true,
            formatBlueprintJson: true,
            groupsCount: true,
            participantsPerGroup: true,
            participants: {
              where: { status: { notIn: [ParticipantStatus.REMOVED, ParticipantStatus.REJECTED] } },
              select: { userId: true, clubSlug: true },
            },
            rosterMembers: {
              where: { userId: session.user.id, status: { not: TeamInviteStatus.REMOVED } },
              select: { id: true },
            },
            registrationApplications: {
              where: { status: TournamentApplicationStatus.PENDING },
              select: { userId: true, clubSlug: true },
            },
          },
        });
        if (!current) throw new RegistrationWriteError("Турнир не найден.", 404);
        if (current.status !== TournamentStatus.REGISTRATION_OPEN) {
          throw new RegistrationWriteError("Регистрация уже закрыта.", 409);
        }
        const currentGroupLimit = getTournamentGroupCapacityLimit(current);
        const currentLimit = Math.min(current.maxParticipants, currentGroupLimit ?? current.maxParticipants);
        if (current.participants.length >= currentLimit) {
          throw new RegistrationWriteError("Лимит участников уже достигнут.", 409);
        }
        if (current.participants.some((entry) => entry.userId === session.user.id) || current.rosterMembers.length > 0) {
          throw new RegistrationWriteError("Участник уже зарегистрирован в этом турнире.", 409);
        }
        if (current.registrationApplications.some((application) => application.userId === session.user.id)) {
          throw new RegistrationWriteError("Ваша заявка уже находится на проверке.", 409);
        }
        if (
          clubSlug &&
          (current.participants.some((entry) => entry.clubSlug === clubSlug) ||
            current.registrationApplications.some((application) => application.userId !== session.user.id && application.clubSlug === clubSlug))
        ) {
          throw new RegistrationWriteError("Этот клуб уже занят другим участником.", 409);
        }

        await tx.tournamentRegistrationApplication.upsert({
        where: {
          tournamentId_userId: {
            tournamentId: params.id,
            userId: session.user.id,
          },
        },
        create: {
          tournamentId: params.id,
          userId: session.user.id,
          clubSlug,
          clubName,
          clubBadgePath,
          teamName: tournament.participantMode === TournamentParticipantMode.TEAM ? teamName : null,
          teamLogo: tournament.participantMode === TournamentParticipantMode.TEAM ? teamLogo || null : null,
          lineupPhotoUrl,
        },
        update: {
          status: TournamentApplicationStatus.PENDING,
          clubSlug,
          clubName,
          clubBadgePath,
          teamName: tournament.participantMode === TournamentParticipantMode.TEAM ? teamName : null,
          teamLogo: tournament.participantMode === TournamentParticipantMode.TEAM ? teamLogo || null : null,
          lineupPhotoUrl,
          rejectionReason: null,
          reviewedAt: null,
          reviewedById: null,
        },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof RegistrationWriteError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ error: "Этот клуб уже указан в другой заявке." }, { status: 409 });
      }
      throw error;
    }

    revalidatePath(`/tournaments/${params.id}`);
    revalidatePath(`/admin/tournaments/${params.id}`);
    revalidatePath(`/admin/tournaments/${params.id}/applications`);

    if (contentType.includes("application/json")) {
      return NextResponse.json({ ok: true, pendingReview: true });
    }

    const origin = getRequestBaseUrl(request);
    return NextResponse.redirect(new URL(`/tournaments/${params.id}`, origin), 303);
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-registration:${params.id}`}))`;

      const current = await tx.tournament.findUnique({
        where: { id: params.id },
        select: {
          status: true,
          maxParticipants: true,
          format: true,
          formatBlueprintJson: true,
          groupsCount: true,
          participantsPerGroup: true,
          participants: {
            where: { status: { notIn: [ParticipantStatus.REMOVED, ParticipantStatus.REJECTED] } },
            select: { userId: true, clubSlug: true },
          },
          rosterMembers: {
            where: { userId: session.user.id, status: { not: TeamInviteStatus.REMOVED } },
            select: { id: true },
          },
          registrationApplications: {
            where: { status: TournamentApplicationStatus.PENDING },
            select: { userId: true, clubSlug: true },
          },
        },
      });

      if (!current) throw new RegistrationWriteError("Турнир не найден.", 404);
      if (current.status !== TournamentStatus.REGISTRATION_OPEN) {
        throw new RegistrationWriteError("Регистрация уже закрыта.", 409);
      }

      const currentGroupLimit = getTournamentGroupCapacityLimit(current);
      const currentLimit = Math.min(current.maxParticipants, currentGroupLimit ?? current.maxParticipants);
      if (current.participants.length >= currentLimit) {
        throw new RegistrationWriteError("Лимит участников уже достигнут.", 409);
      }
      if (current.participants.some((entry) => entry.userId === session.user.id) || current.rosterMembers.length > 0) {
        throw new RegistrationWriteError("Участник уже зарегистрирован в этом турнире.", 409);
      }
      if (
        clubSlug &&
        (current.participants.some((entry) => entry.clubSlug === clubSlug) ||
          current.registrationApplications.some((application) => application.userId !== session.user.id && application.clubSlug === clubSlug))
      ) {
        throw new RegistrationWriteError("Этот клуб уже занят другим участником.", 409);
      }

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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof RegistrationWriteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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

  revalidatePath(`/tournaments/${params.id}`);
  revalidatePath("/tournaments");

  const origin = getRequestBaseUrl(request);
  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(new URL(`/tournaments/${params.id}`, origin), 303);
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

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-registration:${params.id}`}))`;
      const current = await tx.tournament.findUnique({
        where: { id: params.id },
        select: {
          status: true,
          registrationEndsAt: true,
          participants: { where: { userId: session.user.id }, select: { id: true } },
        },
      });
      if (!current) throw new RegistrationWriteError("Турнир не найден.", 404);
      if (current.status === TournamentStatus.IN_PROGRESS || current.status === TournamentStatus.COMPLETED) {
        throw new RegistrationWriteError("Турнир уже начался или завершён.", 409);
      }
      const currentRegistration = current.participants[0];
      if (!currentRegistration) throw new RegistrationWriteError("Регистрация уже отменена.", 409);
      await tx.tournamentRegistration.delete({ where: { id: currentRegistration.id } });
      if (current.registrationEndsAt > new Date()) {
        await tx.tournament.updateMany({
          where: {
            id: params.id,
            status: { in: [TournamentStatus.REGISTRATION_CLOSED, TournamentStatus.AWAITING_START] },
            registrationEndsAt: { gt: new Date() },
          },
          data: { status: TournamentStatus.REGISTRATION_OPEN, registrationClosedAt: null },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof RegistrationWriteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

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

  revalidatePath(`/tournaments/${params.id}`);
  revalidatePath("/tournaments");

  return NextResponse.json({ ok: true });
}
