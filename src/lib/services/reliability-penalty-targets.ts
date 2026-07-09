import { TeamInviteStatus, TournamentParticipantMode } from "@prisma/client";
import { db } from "@/lib/db";

type RosterMember = {
  userId: string;
  status?: TeamInviteStatus | null;
};

export function uniqueReliabilityPenaltyUserIds(userIds: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return userIds.filter((userId): userId is string => {
    if (!userId || seen.has(userId)) return false;
    seen.add(userId);
    return true;
  });
}

export function getAcceptedRosterPenaltyUserIds(registration: { userId?: string | null; rosterMembers: RosterMember[] }) {
  const acceptedMemberIds = registration.rosterMembers
    .filter((member) => !member.status || member.status === TeamInviteStatus.ACCEPTED)
    .map((member) => member.userId);

  return uniqueReliabilityPenaltyUserIds([registration.userId, ...acceptedMemberIds]);
}

export async function getMatchSidePenaltyUserIds(matchId: string, selectedUserId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      player1Id: true,
      player2Id: true,
      tournament: { select: { participantMode: true } },
      lineupPlayers: {
        select: { userId: true, side: true },
        orderBy: [{ side: "asc" }, { createdAt: "asc" }],
      },
      participant1Entry: {
        select: {
          userId: true,
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
            orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
          },
        },
      },
      participant2Entry: {
        select: {
          userId: true,
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
            orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
          },
        },
      },
    },
  });

  if (!match || match.tournament.participantMode !== TournamentParticipantMode.COOP) {
    return [selectedUserId];
  }

  const selectedLineupSide = match.lineupPlayers.find((lineupPlayer) => lineupPlayer.userId === selectedUserId)?.side;
  const selectedCaptainSide = match.player1Id === selectedUserId ? 1 : match.player2Id === selectedUserId ? 2 : null;
  const side = selectedLineupSide ?? selectedCaptainSide;

  if (side !== 1 && side !== 2) {
    return [selectedUserId];
  }

  const lineupSideUserIds = match.lineupPlayers.filter((lineupPlayer) => lineupPlayer.side === side).map((lineupPlayer) => lineupPlayer.userId);
  if (lineupSideUserIds.length) {
    return uniqueReliabilityPenaltyUserIds(lineupSideUserIds);
  }

  const sideEntry = side === 1 ? match.participant1Entry : match.participant2Entry;
  const sideCaptainId = side === 1 ? match.player1Id : match.player2Id;

  return uniqueReliabilityPenaltyUserIds([sideCaptainId, sideEntry?.userId, ...(sideEntry?.rosterMembers.map((member) => member.userId) ?? [])]);
}
