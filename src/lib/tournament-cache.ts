import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";

// Per-tournament, per-domain cache tags. Each of the 4 tournament-detail data
// domains caches independently and is invalidated only when its own data
// changes (see invalidate* helpers below). A 1-hour `revalidate` acts as a
// safety net: if a mutation site ever forgets to invalidate, the data
// self-heals within the hour instead of staying stale forever.
const CACHE_TTL_SECONDS = 60 * 60;

export function tournamentRulesTag(tournamentId: string) {
  return `tournament-rules:${tournamentId}`;
}
export function tournamentParticipantsTag(tournamentId: string) {
  return `tournament-participants:${tournamentId}`;
}
export function tournamentScheduleTag(tournamentId: string) {
  return `tournament-schedule:${tournamentId}`;
}
export function tournamentStructureTag(tournamentId: string) {
  return `tournament-structure:${tournamentId}`;
}

// --- Cached slices (session-independent; identical for every viewer) ---

async function loadRulesSlice(tournamentId: string) {
  return db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      title: true,
      description: true,
      coverImage: true,
      prizePool: true,
      rules: true,
      status: true,
      isTest: true,
      startsAt: true,
      endsAt: true,
      registrationEndsAt: true,
      maxParticipants: true,
      format: true,
      formatBlueprintJson: true,
      playoffType: true,
      clubSelectionMode: true,
      participantMode: true,
      rosterSize: true,
      matchupFormat: true,
      bestOfWins: true,
      requireLineupPhoto: true,
      lineupPhotoExampleUrl: true,
    },
  });
}

async function loadParticipantsSlice(tournamentId: string) {
  return db.tournamentRegistration.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      groupId: true,
      status: true,
      seed: true,
      notes: true,
      clubSlug: true,
      clubName: true,
      clubBadgePath: true,
      teamName: true,
      teamLogo: true,
      rosterMembers: {
        select: {
          id: true,
          status: true,
          isCaptain: true,
          user: { select: { id: true, name: true, telegramUsername: true } },
        },
        orderBy: [{ isCaptain: "desc" }, { invitedAt: "asc" }],
      },
      user: { select: { id: true, name: true, telegramUsername: true } },
    },
  });
}

async function loadScheduleSlice(tournamentId: string) {
  return db.match.findMany({
    where: { tournamentId },
    orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
    select: {
      id: true,
      stageId: true,
      groupId: true,
      bracketId: true,
      round: true,
      matchNumber: true,
      bracket: true,
      seriesKey: true,
      legNumber: true,
      isPenaltyTiebreak: true,
      isThirdPlaceMatch: true,
      scheduledAt: true,
      createdAt: true,
      player1Id: true,
      player2Id: true,
      participant1EntryId: true,
      participant2EntryId: true,
      winnerId: true,
      player1Score: true,
      player2Score: true,
      player1PenaltyScore: true,
      player2PenaltyScore: true,
      status: true,
      notes: true,
      playoffBracket: { select: { legsCount: true } },
      player1: { select: { id: true, name: true } },
      player2: { select: { id: true, name: true } },
      participant1Entry: {
        select: {
          id: true,
          userId: true,
          clubSlug: true,
          clubName: true,
          clubBadgePath: true,
          teamName: true,
          teamLogo: true,
          user: { select: { id: true, name: true } },
        },
      },
      participant2Entry: {
        select: {
          id: true,
          userId: true,
          clubSlug: true,
          clubName: true,
          clubBadgePath: true,
          teamName: true,
          teamLogo: true,
          user: { select: { id: true, name: true } },
        },
      },
      stage: {
        select: {
          id: true,
          name: true,
          type: true,
          orderIndex: true,
          roundsCount: true,
          deadlines: { select: { round: true, deadlineAt: true } },
        },
      },
      group: { select: { id: true, name: true, orderIndex: true } },
      schedules: { select: { startsAt: true } },
    },
  });
}

async function loadStructureSlice(tournamentId: string) {
  return db.tournamentStage.findMany({
    where: { tournamentId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      orderIndex: true,
      startsAt: true,
      endsAt: true,
      advancingPerGroup: true,
      participantsPerGroup: true,
      pointsForWin: true,
      pointsForDraw: true,
      pointsForLoss: true,
      roundsCount: true,
      groups: {
        select: { id: true, name: true, orderIndex: true, capacity: true },
        orderBy: { orderIndex: "asc" },
      },
      bracket: { select: { id: true } },
    },
  });
}

export type TournamentRulesSlice = Awaited<ReturnType<typeof loadRulesSlice>>;
export type TournamentParticipantsSlice = Awaited<ReturnType<typeof loadParticipantsSlice>>;
export type TournamentScheduleSlice = Awaited<ReturnType<typeof loadScheduleSlice>>;
export type TournamentStructureSlice = Awaited<ReturnType<typeof loadStructureSlice>>;

// Each wrapper keys on the tournament id (Next folds the fn args into the cache
// key) and is tagged so mutations can bust exactly one domain.
export function getCachedTournamentRules(tournamentId: string) {
  return unstable_cache(loadRulesSlice, ["tournament-rules"], {
    revalidate: CACHE_TTL_SECONDS,
    tags: [tournamentRulesTag(tournamentId)],
  })(tournamentId);
}
export function getCachedTournamentParticipants(tournamentId: string) {
  return unstable_cache(loadParticipantsSlice, ["tournament-participants"], {
    revalidate: CACHE_TTL_SECONDS,
    tags: [tournamentParticipantsTag(tournamentId)],
  })(tournamentId);
}
export function getCachedTournamentSchedule(tournamentId: string) {
  return unstable_cache(loadScheduleSlice, ["tournament-schedule"], {
    revalidate: CACHE_TTL_SECONDS,
    tags: [tournamentScheduleTag(tournamentId)],
  })(tournamentId);
}
export function getCachedTournamentStructure(tournamentId: string) {
  return unstable_cache(loadStructureSlice, ["tournament-structure"], {
    revalidate: CACHE_TTL_SECONDS,
    tags: [tournamentStructureTag(tournamentId)],
  })(tournamentId);
}

// --- Invalidation helpers (call after a successful write) ---

export function invalidateTournamentRules(tournamentId: string) {
  revalidateTag(tournamentRulesTag(tournamentId));
}
export function invalidateTournamentParticipants(tournamentId: string) {
  revalidateTag(tournamentParticipantsTag(tournamentId));
}
export function invalidateTournamentSchedule(tournamentId: string) {
  revalidateTag(tournamentScheduleTag(tournamentId));
}
export function invalidateTournamentStructure(tournamentId: string) {
  revalidateTag(tournamentStructureTag(tournamentId));
}

// Busts all four domains at once — for create/delete/regenerate/reset/start
// where nearly everything changes.
export function invalidateTournamentAll(tournamentId: string) {
  invalidateTournamentRules(tournamentId);
  invalidateTournamentParticipants(tournamentId);
  invalidateTournamentSchedule(tournamentId);
  invalidateTournamentStructure(tournamentId);
}
