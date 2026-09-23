import { NextResponse } from "next/server";
import { ParticipantStatus, TeamInviteStatus } from "@prisma/client";
import { assertCanManageTournament } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canReuseActiveParticipant } from "@/lib/tournaments/participant-reuse";

function normalizeQuery(value: string | null) {
  return value?.trim().replace(/^@/, "") ?? "";
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.manageParticipants");
  await assertCanManageTournament(session, params.id);

  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("q"));
  const rosterScope = searchParams.get("scope") === "roster";
  const replacementScope = searchParams.get("scope") === "replace";
  const targetRegistrationId = searchParams.get("targetRegistrationId");

  if (query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const [tournamentParticipants, rosterMembers] = await Promise.all([
    db.tournamentRegistration.findMany({
      where: { tournamentId: params.id, status: { not: ParticipantStatus.REMOVED } },
      select: {
        id: true,
        userId: true,
        tournament: { select: { participantMode: true } },
        rosterMembers: {
          where: { status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] } },
          select: { userId: true },
        },
      },
    }),
    db.tournamentRegistrationMember.findMany({
      where: {
        tournamentId: params.id,
        status: { in: [TeamInviteStatus.PENDING, TeamInviteStatus.ACCEPTED] },
        registration: { status: { not: ParticipantStatus.REMOVED } },
      },
      select: { userId: true },
    }),
  ]);

  const reusableActiveUserIds = new Set(
    replacementScope && targetRegistrationId
      ? tournamentParticipants
        .filter((participant) => canReuseActiveParticipant({
          registrationId: participant.id,
          userId: participant.userId,
          participantMode: participant.tournament.participantMode as "SINGLE" | "COOP" | "TEAM",
          rosterMemberUserIds: participant.rosterMembers.map((member) => member.userId),
        }, targetRegistrationId))
        .map((participant) => participant.userId)
      : [],
  );
  const excludedUserIds = Array.from(
    new Set([
      ...(rosterScope
        ? []
        : replacementScope
          ? tournamentParticipants
            .filter((participant) => !reusableActiveUserIds.has(participant.userId) || participant.id === targetRegistrationId)
            .map((participant) => participant.userId)
          : tournamentParticipants.map((participant) => participant.userId)),
      ...rosterMembers
        .filter((member) => !replacementScope || !reusableActiveUserIds.has(member.userId))
        .map((member) => member.userId),
    ]),
  );
  const users = await db.user.findMany({
    where: {
      isBanned: false,
      AND: [
        {
          OR: [
            { bannedUntil: null },
            { bannedUntil: { lte: new Date() } },
          ],
        },
        {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { publicId: { contains: query, mode: "insensitive" } },
            { telegramUsername: { contains: query, mode: "insensitive" } },
            { favoriteTeam: { contains: query, mode: "insensitive" } },
            {
              tournamentEntries: {
                some: {
                  OR: [
                    { clubName: { contains: query, mode: "insensitive" } },
                    { clubSlug: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
      ],
      id: { notIn: excludedUserIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
      publicId: true,
      telegramUsername: true,
      favoriteTeam: true,
      tournamentEntries: {
        where: {
          OR: [
            { clubName: { not: null } },
            { clubSlug: { not: null } },
          ],
        },
        select: {
          clubName: true,
          clubSlug: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    take: 12,
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      publicId: user.publicId,
      telegramUsername: user.telegramUsername,
      favoriteTeam: user.favoriteTeam,
      clubs: Array.from(
        new Set(
          [user.favoriteTeam, ...user.tournamentEntries.flatMap((entry) => [entry.clubName, entry.clubSlug])].filter(Boolean) as string[],
        ),
      ).slice(0, 4),
    })),
  });
}
