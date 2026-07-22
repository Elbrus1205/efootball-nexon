import {
  NotificationType,
  ParticipantStatus,
  TeamInviteStatus,
  TournamentStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import {
  syncTournamentLifecycleStatus,
  syncTournamentPreviewGroups,
} from "@/lib/services/tournaments";
import { invalidateTournamentParticipants } from "@/lib/tournament-cache";

class RosterWriteError extends Error {}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const session = await requireAuth();
  const payload = await request.json().catch(() => ({}));
  const action =
    payload.action === "accept"
      ? "accept"
      : payload.action === "decline"
        ? "decline"
        : null;

  if (!action) {
    return NextResponse.json(
      { error: "Неизвестное действие." },
      { status: 400 },
    );
  }

  const invite = await db.tournamentRegistrationMember.findFirst({
    where: {
      tournamentId: params.id,
      userId: session.user.id,
      status: TeamInviteStatus.PENDING,
    },
    include: {
      tournament: {
        select: {
          id: true,
          title: true,
          status: true,
          rosterSize: true,
          notificationsEnabled: true,
        },
      },
      registration: { include: { user: { select: { id: true } } } },
    },
  });

  if (!invite) {
    return NextResponse.json(
      { error: "Активное приглашение не найдено." },
      { status: 404 },
    );
  }

  if (invite.tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return NextResponse.json(
      { error: "Приглашение уже недоступно." },
      { status: 400 },
    );
  }

  if (action === "decline") {
    try {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-roster:${invite.registrationId}`}))`;
        const declined = await tx.tournamentRegistrationMember.updateMany({
          where: { id: invite.id, status: TeamInviteStatus.PENDING },
          data: { status: TeamInviteStatus.DECLINED, respondedAt: new Date() },
        });
        if (declined.count !== 1) {
          throw new RosterWriteError("Приглашение уже обработано.");
        }
      });
    } catch (error) {
      if (error instanceof RosterWriteError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }

    invalidateTournamentParticipants(params.id);
    return NextResponse.json({ ok: true });
  }

  const activeMembersCount = await db.tournamentRegistrationMember.count({
    where: {
      registrationId: invite.registrationId,
      status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
    },
  });

  if (activeMembersCount > invite.tournament.rosterSize) {
    return NextResponse.json(
      { error: "В составе уже нет свободных мест." },
      { status: 400 },
    );
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-roster:${invite.registrationId}`}))`;

      const currentInvite = await tx.tournamentRegistrationMember.findUnique({
        where: { id: invite.id },
        select: {
          status: true,
          registrationId: true,
          tournament: { select: { status: true, rosterSize: true } },
        },
      });
      if (!currentInvite || currentInvite.status !== TeamInviteStatus.PENDING) {
        throw new RosterWriteError("Приглашение уже обработано.");
      }
      if (
        currentInvite.tournament.status !== TournamentStatus.REGISTRATION_OPEN
      ) {
        throw new RosterWriteError("Регистрация уже закрыта.");
      }

      const acceptedBefore = await tx.tournamentRegistrationMember.count({
        where: {
          registrationId: currentInvite.registrationId,
          status: TeamInviteStatus.ACCEPTED,
        },
      });
      if (acceptedBefore >= currentInvite.tournament.rosterSize) {
        throw new RosterWriteError("В составе уже нет свободных мест.");
      }

      const accepted = await tx.tournamentRegistrationMember.updateMany({
        where: { id: invite.id, status: TeamInviteStatus.PENDING },
        data: { status: TeamInviteStatus.ACCEPTED, respondedAt: new Date() },
      });
      if (accepted.count !== 1)
        throw new RosterWriteError("Приглашение уже обработано.");

      const acceptedMembersCount = acceptedBefore + 1;

      await tx.tournamentRegistration.update({
        where: { id: currentInvite.registrationId },
        data: {
          status:
            acceptedMembersCount >= currentInvite.tournament.rosterSize
              ? ParticipantStatus.CONFIRMED
              : ParticipantStatus.PENDING,
        },
      });
    });
  } catch (error) {
    if (error instanceof RosterWriteError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  invalidateTournamentParticipants(params.id);
  await syncTournamentPreviewGroups(params.id).catch(() => null);
  await syncTournamentLifecycleStatus(params.id).catch(() => null);

  if (invite.tournament.notificationsEnabled) {
    await createNotification({
      userId: invite.registration.userId,
      title: "Игрок принял приглашение",
      body: `${invite.tournament.title}: игрок присоединился к составу.`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${invite.tournament.id}`,
      dedupeWithinHours: 1,
    });
  }

  revalidatePath(`/tournaments/${params.id}`);
  return NextResponse.json({ ok: true });
}
