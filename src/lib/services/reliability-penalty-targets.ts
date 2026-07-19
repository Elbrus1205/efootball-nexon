import { TeamInviteStatus, TournamentParticipantMode } from "@prisma/client";
import { db } from "@/lib/db";

type RosterMember = {
  userId: string;
  status?: TeamInviteStatus | null;
};

type MatchPenaltyTargetSnapshot = {
  player1Id: string | null;
  player2Id: string | null;
  participantMode: TournamentParticipantMode;
  lineupPlayers: Array<{ userId: string; side: number }>;
  participant1Entry: { userId: string; rosterMembers: RosterMember[] } | null;
  participant2Entry: { userId: string; rosterMembers: RosterMember[] } | null;
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

export function resolveMatchPenaltyTargetUserIds(match: MatchPenaltyTargetSnapshot, selectedUserIds: string[]) {
  const uniqueSelectedUserIds = uniqueReliabilityPenaltyUserIds(selectedUserIds);
  if (match.participantMode !== TournamentParticipantMode.COOP) {
    return uniqueSelectedUserIds;
  }

  const targetUserIds = uniqueSelectedUserIds.flatMap((selectedUserId) => {
    const selectedLineupSide = match.lineupPlayers.find((lineupPlayer) => lineupPlayer.userId === selectedUserId)?.side;
    const selectedCaptainSide = match.player1Id === selectedUserId ? 1 : match.player2Id === selectedUserId ? 2 : null;
    const side = selectedLineupSide ?? selectedCaptainSide;

    if (side !== 1 && side !== 2) {
      return [selectedUserId];
    }

    const lineupSideUserIds = match.lineupPlayers.filter((lineupPlayer) => lineupPlayer.side === side).map((lineupPlayer) => lineupPlayer.userId);
    if (lineupSideUserIds.length) {
      return lineupSideUserIds;
    }

    const sideEntry = side === 1 ? match.participant1Entry : match.participant2Entry;
    const sideCaptainId = side === 1 ? match.player1Id : match.player2Id;

    return [sideCaptainId, sideEntry?.userId, ...(sideEntry?.rosterMembers.map((member) => member.userId) ?? [])];
  });

  return uniqueReliabilityPenaltyUserIds(targetUserIds);
}

export async function getMatchPenaltyTargetUserIds(matchId: string, selectedUserIds: string[]) {
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

  if (!match) {
    return uniqueReliabilityPenaltyUserIds(selectedUserIds);
  }

  return resolveMatchPenaltyTargetUserIds(
    {
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      participantMode: match.tournament.participantMode,
      lineupPlayers: match.lineupPlayers,
      participant1Entry: match.participant1Entry,
      participant2Entry: match.participant2Entry,
    },
    selectedUserIds,
  );
}

export async function getMatchSidePenaltyUserIds(matchId: string, selectedUserId: string) {
  return getMatchPenaltyTargetUserIds(matchId, [selectedUserId]);
}
