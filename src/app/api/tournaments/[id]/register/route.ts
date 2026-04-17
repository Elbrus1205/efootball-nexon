import { ClubSelectionMode, TournamentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { syncTournamentLifecycleStatus } from "@/lib/services/tournaments";
import { formatTournamentBanMessage } from "@/lib/user-ban";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isBanned: true, banReason: true, bannedUntil: true },
  });
  const banMessage = formatTournamentBanMessage(user);

  if (banMessage) {
    return NextResponse.json({ error: banMessage }, { status: 403 });
  }

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: { participants: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Турнир не найден." }, { status: 404 });
  }

  if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return NextResponse.json({ error: "Регистрация уже закрыта." }, { status: 400 });
  }

  if (tournament.participants.length >= tournament.maxParticipants) {
    return NextResponse.json({ error: "Лимит участников уже достигнут." }, { status: 400 });
  }

  const existingRegistration = tournament.participants.find((entry) => entry.userId === session.user.id);
  if (existingRegistration) {
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

  await db.tournamentRegistration.create({
    data: {
      tournamentId: params.id,
      userId: session.user.id,
      clubSlug,
      clubName,
      clubBadgePath,
    },
  });

  await syncTournamentLifecycleStatus(params.id);
  revalidatePath(`/tournaments/${params.id}`);
  revalidatePath("/tournaments");

  const origin = new URL(request.url).origin;
  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.redirect(new URL(`/tournaments/${params.id}`, origin));
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
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

  if (tournament.status === TournamentStatus.REGISTRATION_CLOSED && tournament.registrationEndsAt > new Date()) {
    await db.tournament.update({
      where: { id: params.id },
      data: { status: TournamentStatus.REGISTRATION_OPEN, registrationClosedAt: null },
    });
  }

  revalidatePath(`/tournaments/${params.id}`);
  revalidatePath("/tournaments");

  return NextResponse.json({ ok: true });
}
