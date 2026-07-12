import { NotificationType, ParticipantStatus, TeamInviteStatus, TournamentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import { syncTournamentLifecycleStatus, syncTournamentPreviewGroups } from "@/lib/services/tournaments";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAuth();
  const payload = await request.json().catch(() => ({}));
  const action = payload.action === "accept" ? "accept" : payload.action === "decline" ? "decline" : null;

  if (!action) {
    return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
  }

  const invite = await db.tournamentRegistrationMember.findFirst({
    where: {
      tournamentId: params.id,
      userId: session.user.id,
      status: TeamInviteStatus.PENDING,
    },
    include: {
      tournament: { select: { id: true, title: true, status: true, rosterSize: true, notificationsEnabled: true } },
      registration: { include: { user: { select: { id: true } } } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Активное приглашение не найдено." }, { status: 404 });
  }

  if (invite.tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return NextResponse.json({ error: "Приглашение уже недоступно." }, { status: 400 });
  }

  if (action === "decline") {
    await db.tournamentRegistrationMember.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.DECLINED, respondedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  }

  const activeMembersCount = await db.tournamentRegistrationMember.count({
    where: {
      registrationId: invite.registrationId,
      status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
    },
  });

  if (activeMembersCount > invite.tournament.rosterSize) {
    return NextResponse.json({ error: "В составе уже нет свободных мест." }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.tournamentRegistrationMember.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.ACCEPTED, respondedAt: new Date() },
    });

    const acceptedMembersCount = await tx.tournamentRegistrationMember.count({
      where: { registrationId: invite.registrationId, status: TeamInviteStatus.ACCEPTED },
    });

    await tx.tournamentRegistration.update({
      where: { id: invite.registrationId },
      data: {
        status: acceptedMembersCount >= invite.tournament.rosterSize ? ParticipantStatus.CONFIRMED : ParticipantStatus.PENDING,
      },
    });
  });

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
