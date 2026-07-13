import {
  AdminActionType,
  NotificationType,
  ParticipantStatus,
  Prisma,
  TournamentApplicationStatus,
  TournamentStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import { getTournamentGroupCapacityLimit, syncTournamentLifecycleStatus, syncTournamentPreviewGroups } from "@/lib/services/tournaments";
import { applicationDecisionSchema, participantStatusAfterApplicationApproval } from "@/lib/tournament-applications";

type RouteContext = { params: Promise<{ id: string; applicationId: string }> };

export async function PATCH(request: Request, props: RouteContext) {
  const params = await props.params;
  const session = await requirePermission("tournaments.manageParticipants");
  await assertCanManageTournament(session, params.id);

  const parsed = applicationDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Не удалось проверить решение по заявке." },
      { status: 400 },
    );
  }

  const application = await db.tournamentRegistrationApplication.findFirst({
    where: { id: params.applicationId, tournamentId: params.id },
    include: {
      tournament: {
        select: {
          id: true,
          title: true,
          status: true,
          participantMode: true,
          maxParticipants: true,
          format: true,
          groupsCount: true,
          participantsPerGroup: true,
          formatBlueprintJson: true,
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Заявка не найдена." }, { status: 404 });
  }
  if (application.status !== TournamentApplicationStatus.PENDING) {
    return NextResponse.json({ error: "Эта заявка уже обработана." }, { status: 409 });
  }

  if (parsed.data.action === "reject") {
    const reviewedAt = new Date();
    const rejectionReason = parsed.data.reason;
    try {
      await db.$transaction(async (tx) => {
        const updated = await tx.tournamentRegistrationApplication.updateMany({
          where: { id: application.id, status: TournamentApplicationStatus.PENDING },
          data: {
            status: TournamentApplicationStatus.REJECTED,
            rejectionReason,
            reviewedAt,
            reviewedById: session.user.id,
            clubSlug: null,
          },
        });
        if (!updated.count) throw new Error("APPLICATION_ALREADY_REVIEWED");

        await tx.adminAction.create({
          data: {
            adminId: session.user.id,
            tournamentId: params.id,
            entityType: "TournamentRegistrationApplication",
            entityId: application.id,
            actionType: AdminActionType.REJECT,
            beforeJson: { status: application.status },
            afterJson: { status: TournamentApplicationStatus.REJECTED, reason: rejectionReason },
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "APPLICATION_ALREADY_REVIEWED") {
        return NextResponse.json({ error: "Эта заявка уже обработана." }, { status: 409 });
      }
      throw error;
    }

    await createNotification({
      userId: application.userId,
      title: "Заявка на турнир отклонена",
      body: `${application.tournament.title}: ${rejectionReason}`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${params.id}`,
    });

    revalidateApplicationPaths(params.id);
    return NextResponse.json({ ok: true, status: TournamentApplicationStatus.REJECTED });
  }

  if (
    application.tournament.status === TournamentStatus.IN_PROGRESS ||
    application.tournament.status === TournamentStatus.COMPLETED
  ) {
    return NextResponse.json({ error: "Нельзя принять заявку после начала турнира." }, { status: 409 });
  }

  try {
    await db.$transaction(
      async (tx) => {
        const lockedApplication = await tx.tournamentRegistrationApplication.findFirst({
          where: {
            id: application.id,
            tournamentId: params.id,
            status: TournamentApplicationStatus.PENDING,
          },
          select: { id: true },
        });
        if (!lockedApplication) throw new Error("APPLICATION_ALREADY_REVIEWED");

        const participantCount = await tx.tournamentRegistration.count({
          where: {
            tournamentId: params.id,
            status: { notIn: [ParticipantStatus.REJECTED, ParticipantStatus.REMOVED] },
          },
        });
        const groupLimit = getTournamentGroupCapacityLimit(application.tournament);
        const registrationLimit = Math.min(
          application.tournament.maxParticipants,
          groupLimit ?? application.tournament.maxParticipants,
        );
        if (participantCount >= registrationLimit) throw new Error("TOURNAMENT_FULL");

        const registration = await tx.tournamentRegistration.create({
          data: {
            tournamentId: params.id,
            userId: application.userId,
            clubSlug: application.clubSlug,
            clubName: application.clubName,
            clubBadgePath: application.clubBadgePath,
            teamName: application.teamName,
            teamLogo: application.teamLogo,
            status: participantStatusAfterApplicationApproval(application.tournament.participantMode),
            approvedAt: new Date(),
          },
        });

        await tx.tournamentRegistrationMember.create({
          data: {
            tournamentId: params.id,
            registrationId: registration.id,
            userId: application.userId,
            status: "ACCEPTED",
            isCaptain: true,
            respondedAt: new Date(),
          },
        });

        await tx.tournamentRegistrationApplication.update({
          where: { id: application.id },
          data: {
            status: TournamentApplicationStatus.APPROVED,
            rejectionReason: null,
            reviewedAt: new Date(),
            reviewedById: session.user.id,
          },
        });

        await tx.adminAction.create({
          data: {
            adminId: session.user.id,
            tournamentId: params.id,
            entityType: "TournamentRegistrationApplication",
            entityId: application.id,
            actionType: AdminActionType.APPROVE,
            beforeJson: { status: application.status },
            afterJson: { status: TournamentApplicationStatus.APPROVED, registrationId: registration.id },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "APPLICATION_ALREADY_REVIEWED") {
      return NextResponse.json({ error: "Эта заявка уже обработана." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "TOURNAMENT_FULL") {
      return NextResponse.json({ error: "Лимит участников уже достигнут." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Игрок или выбранный клуб уже зарегистрирован." }, { status: 409 });
    }
    throw error;
  }

  await Promise.all([
    syncTournamentPreviewGroups(params.id).catch(() => null),
    syncTournamentLifecycleStatus(params.id).catch(() => null),
    createNotification({
      userId: application.userId,
      title: "Заявка на турнир принята",
      body: `${application.tournament.title}: вы зарегистрированы. Следите за расписанием и уведомлениями.` ,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${params.id}`,
    }),
  ]);

  revalidateApplicationPaths(params.id);
  return NextResponse.json({ ok: true, status: TournamentApplicationStatus.APPROVED });
}

function revalidateApplicationPaths(tournamentId: string) {
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/admin/tournaments/${tournamentId}/applications`);
  revalidatePath(`/admin/tournaments/${tournamentId}/participants`);
}
