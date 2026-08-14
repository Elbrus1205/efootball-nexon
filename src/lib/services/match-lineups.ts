import { MatchStatus, Prisma, TeamInviteStatus, TournamentParticipantMode } from "@prisma/client";
import { db } from "@/lib/db";

type MatchLineupClient = Pick<typeof db, "match" | "matchLineupPlayer">;
type MatchLineupTransactionClient = Pick<Prisma.TransactionClient, "matchLineupPlayer">;

type LineupMatch = NonNullable<Awaited<ReturnType<typeof getLineupMatch>>>;

async function getLineupMatch(client: MatchLineupClient, matchId: string) {
  return client.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      player1Id: true,
      player2Id: true,
      participant1EntryId: true,
      participant2EntryId: true,
      tournament: { select: { participantMode: true } },
      participant1Entry: {
        select: {
          id: true,
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
            orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
          },
        },
      },
      participant2Entry: {
        select: {
          id: true,
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
            orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
          },
        },
      },
    },
  });
}

function uniqueUserIds(userIds: Array<string | null>) {
  const seen = new Set<string>();
  return userIds.filter((userId): userId is string => {
    if (!userId || seen.has(userId)) return false;
    seen.add(userId);
    return true;
  });
}

function getSideLineup(match: LineupMatch, side: 1 | 2) {
  const captainId = side === 1 ? match.player1Id : match.player2Id;
  const entry = side === 1 ? match.participant1Entry : match.participant2Entry;
  const registrationId = side === 1 ? match.participant1EntryId : match.participant2EntryId;
  const rosterUserIds = match.tournament.participantMode === TournamentParticipantMode.COOP
    ? entry?.rosterMembers.map((member) => member.userId) ?? []
    : [];

  return uniqueUserIds([captainId, ...rosterUserIds]).map((userId) => ({
    matchId: match.id,
    userId,
    side,
    registrationId,
  }));
}

export async function ensureMatchLineupSnapshot(matchId: string, client: MatchLineupClient = db) {
  const existing = await client.matchLineupPlayer.findMany({
    where: { matchId },
    select: { userId: true, side: true },
  });

  if (existing.length) {
    return existing;
  }

  const match = await getLineupMatch(client, matchId);
  if (!match) return [];

  const lineup = [...getSideLineup(match, 1), ...getSideLineup(match, 2)];
  if (!lineup.length) return [];

  await client.matchLineupPlayer.createMany({
    data: lineup,
    skipDuplicates: true,
  });

  return lineup.map((item) => ({ userId: item.userId, side: item.side }));
}

export async function replaceMatchLineupSnapshotPlayer(params: {
  client: MatchLineupTransactionClient;
  matchId: string;
  side: 1 | 2;
  previousUserId: string | null;
  nextUserId: string;
  registrationId: string | null;
}) {
  if (!params.previousUserId || params.previousUserId === params.nextUserId) return;

  const existing = await params.client.matchLineupPlayer.findUnique({
    where: {
      matchId_side_userId: {
        matchId: params.matchId,
        side: params.side,
        userId: params.previousUserId,
      },
    },
    select: { id: true },
  });
  if (!existing) return;

  await params.client.matchLineupPlayer.update({
    where: { id: existing.id },
    data: {
      userId: params.nextUserId,
      registrationId: params.registrationId,
    },
  });
}

export async function backfillConfirmedMatchLineups(limit = 500) {
  const matches = await db.match.findMany({
    where: {
      status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED] },
      player1Score: { not: null },
      player2Score: { not: null },
      isPenaltyTiebreak: false,
      lineupPlayers: { none: {} },
    },
    select: {
      id: true,
      player1Id: true,
      player2Id: true,
      participant1EntryId: true,
      participant2EntryId: true,
      tournament: { select: { participantMode: true } },
      participant1Entry: {
        select: {
          id: true,
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
            orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
          },
        },
      },
      participant2Entry: {
        select: {
          id: true,
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
            orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
          },
        },
      },
    },
    orderBy: [{ finishedAt: "asc" }, { updatedAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  const lineup = matches.flatMap((match) => [...getSideLineup(match, 1), ...getSideLineup(match, 2)]);
  if (lineup.length) {
    await db.matchLineupPlayer.createMany({
      data: lineup,
      skipDuplicates: true,
    });
  }

  return { processed: matches.length };
}
