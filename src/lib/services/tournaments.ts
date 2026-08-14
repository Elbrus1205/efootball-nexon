import {
  ClubSelectionMode,
  MatchStatus,
  MatchupFormat,
  NotificationType,
  ParticipantStatus,
  PlayoffType,
  SeedingMethod,
  StageStatus,
  StageType,
  TeamInviteStatus,
  TournamentFormat,
  TournamentParticipantMode,
  TournamentStatus,
  type TournamentStage,
} from "@prisma/client";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { tournamentFormatLabel, tournamentStatusLabel } from "@/lib/admin-display";
import { db } from "@/lib/db";
import { getAvailableClubs } from "@/lib/clubs";
import { normalizeFormatBlueprint, type FormatBlueprint, type PlayoffSelectionRule } from "@/lib/format-blueprint";
import { applyTournamentAbsenceRatingPenalty, getPlayerRatings } from "@/lib/ratings";
import { invalidatePlayerRatings } from "@/lib/ratings-cache";
import { prepareCaptainAssignedTeamMatchSlots } from "@/lib/tournaments/captain-team-matches";
import {
  buildRandomCaptainTeamAssignments,
  resolveActiveCaptainTeamRound,
} from "@/lib/tournaments/captain-team-auto-assignment";
import { resolveCaptainTeamPlayoffAggregate } from "@/lib/tournaments/captain-team-playoff";
import {
  invalidateTournamentAll,
  invalidateTournamentParticipants,
  invalidateTournamentRules,
  invalidateTournamentSchedule,
  invalidateTournamentStructure,
} from "@/lib/tournament-cache";
import {
  assignParticipantsByGroupCapacity,
  orderParticipantsByRating,
  shuffleParticipants,
} from "@/lib/tournament-participant-assignment";
import { grantCurrentChampionProfileStatus } from "@/lib/profile-statuses";
import { createNotification, createNotificationsForUsers } from "@/lib/services/notifications";
import { publishTournamentCompletion } from "@/lib/services/telegram-publications";
import { buildPersonalMatchMessage } from "@/lib/telegram-rich";
import { withRemindLaterButton } from "@/lib/services/telegram-callbacks";

function createGroupSourceRef(groupId: string, rank: number) {
  return `group:${groupId}:rank:${rank}`;
}

type CustomPlayoffSettings = {
  mode: "custom";
  selections: PlayoffSelectionRule[];
  upperEntriesCount: number;
  lowerEntriesCount: number;
};

function isCustomTourCountStage(stage: { settingsJson?: unknown }) {
  const settings = stage.settingsJson;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return false;
  }

  const mode = (settings as { mode?: unknown }).mode;
  return mode === "custom-groups" || mode === "custom-league";
}

function getCustomMatchesPerOpponent(stage: { settingsJson?: unknown }) {
  const settings = stage.settingsJson;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }

  const matchesPerOpponent = Number((settings as { matchesPerOpponent?: unknown }).matchesPerOpponent);
  return Number.isFinite(matchesPerOpponent) ? Math.max(1, Math.min(6, matchesPerOpponent)) : null;
}

function getCustomStageMatchesPerOpponent(stage: { settingsJson?: unknown }, formatBlueprintJson?: unknown) {
  const stageValue = getCustomMatchesPerOpponent(stage);
  if (stageValue) {
    return stageValue;
  }

  if (!isCustomTourCountStage(stage)) {
    return null;
  }

  if (formatBlueprintJson == null) {
    return null;
  }

  const blueprint = normalizeFormatBlueprint(formatBlueprintJson);
  return Math.max(1, Math.min(6, blueprint.roundsCount));
}

function getRoundRobinToursCount(participantsCount: number) {
  const normalizedSlotsCount = participantsCount % 2 === 0 ? participantsCount : participantsCount + 1;
  return Math.max(normalizedSlotsCount - 1, 1);
}

function createEntryPairKey(firstEntryId: string, secondEntryId: string) {
  return [firstEntryId, secondEntryId].sort().join(":");
}

const TERMINAL_MATCH_STATUSES = new Set<MatchStatus>([
  MatchStatus.CONFIRMED,
  MatchStatus.FINISHED,
  MatchStatus.FORFEIT,
  MatchStatus.CANCELLED,
]);
const AUTO_BYE_NOTE = "AUTO_BYE";
const CAPTAIN_TEAM_AUTO_ASSIGNMENT_DELAY_MS = 8 * 60 * 60 * 1_000;

function tournamentNotificationsEnabled(tournament: { notificationsEnabled?: boolean | null }) {
  return tournament.notificationsEnabled !== false;
}

export function getTournamentRegistrationOpenAt(tournament: { registrationStartsAt: Date | null; startsAt: Date }) {
  return tournament.registrationStartsAt ?? tournament.startsAt;
}

export function resolveAutoRegistrationStatus(
  status: TournamentStatus,
  autoOpenRegistration: boolean,
  registrationOpenAt: Date,
  now = new Date(),
) {
  if (!autoOpenRegistration) return status;
  if (status !== TournamentStatus.DRAFT && status !== TournamentStatus.REGISTRATION_OPEN) return status;
  if (status === TournamentStatus.REGISTRATION_OPEN) return status;
  return registrationOpenAt <= now ? TournamentStatus.REGISTRATION_OPEN : TournamentStatus.DRAFT;
}

export function shouldSyncTournamentRegistrationLifecycle(tournament: {
  status: TournamentStatus;
  autoOpenRegistration: boolean;
  registrationStartsAt: Date | null;
  startsAt: Date;
}) {
  return (
    tournament.status === TournamentStatus.DRAFT &&
    tournament.autoOpenRegistration &&
    getTournamentRegistrationOpenAt(tournament) <= new Date()
  );
}

function nextPowerOfTwo(value: number) {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(value, 2))));
}

function createFirstRoundSlotEntries<T>(entries: T[], bracketSize: number): (T | null)[] {
  const slotEntries: (T | null)[] = Array.from({ length: bracketSize }, () => null);
  const byeCount = Math.max(0, bracketSize - entries.length);
  const directMatchCount = bracketSize / 2;

  for (let index = 0; index < entries.length; index += 1) {
    if (index < byeCount) {
      slotEntries[index * 2] = entries[index];
      continue;
    }

    const compactIndex = index - byeCount;
    const slotIndex = byeCount * 2 + compactIndex;
    if (slotIndex < bracketSize) {
      slotEntries[slotIndex] = entries[index];
      continue;
    }

    const fallbackMatch = index % directMatchCount;
    const fallbackSlot = index < directMatchCount ? 0 : 1;
    slotEntries[fallbackMatch * 2 + fallbackSlot] = entries[index];
  }

  return slotEntries;
}

type GroupPlayoffEntry = {
  groupId: string;
  groupOrder: number;
  rank: number;
};

type GroupPlayoffSlotMapping = {
  round: 1;
  matchNumber: number;
  slotNumber: 1 | 2;
  sourceRef?: string;
};

function parseGroupSourceRef(sourceRef?: string | null) {
  const match = /^group:(.+):rank:(\d+)$/.exec(sourceRef ?? "");
  if (!match) return null;

  return {
    groupId: match[1],
    rank: Number(match[2]),
  };
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed) || 1;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string) {
  const shuffled = [...items];
  const random = createSeededRandom(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

type TournamentSeedParticipant = {
  userId: string;
  rosterMembers: readonly { userId: string }[];
};

async function orderTournamentParticipantsForSeeding<T extends TournamentSeedParticipant>(
  participants: readonly T[],
  seedingMethod: SeedingMethod,
  seasonId: string | null,
) {
  if (seedingMethod === SeedingMethod.RANDOM) {
    return { ordered: shuffleParticipants(participants), shouldPersistSeeds: true };
  }

  if (seedingMethod === SeedingMethod.RANKING) {
    const ratings = await getPlayerRatings({ seasonId });
    return {
      ordered: orderParticipantsByRating(
        participants,
        new Map(ratings.map((row) => [row.playerId, row.rating])),
      ),
      shouldPersistSeeds: true,
    };
  }

  return { ordered: [...participants], shouldPersistSeeds: false };
}

function pairEntriesAcrossGroups(leftEntries: GroupPlayoffEntry[], rightEntries: GroupPlayoffEntry[], seed: string) {
  const left = [...leftEntries].sort((a, b) => a.groupOrder - b.groupOrder || a.rank - b.rank);
  const right = [...rightEntries].sort((a, b) => a.groupOrder - b.groupOrder || a.rank - b.rank);

  if (!left.length) {
    return right.map((entry) => [entry, null] as const);
  }

  if (!right.length) {
    return left.map((entry) => [entry, null] as const);
  }

  const pairs: Array<readonly [GroupPlayoffEntry | null, GroupPlayoffEntry | null]> = [];
  const offset = right.length > 1 ? (hashSeed(seed) % (right.length - 1)) + 1 : 0;

  for (let index = 0; index < left.length; index += 1) {
    let opponent = right[(index + offset) % right.length] ?? null;

    if (opponent?.groupId === left[index].groupId && right.length > 1) {
      opponent = right.find((entry) => entry.groupId !== left[index].groupId) ?? opponent;
    }

    pairs.push([left[index], opponent]);
  }

  for (let index = left.length; index < right.length; index += 1) {
    pairs.push([null, right[index]]);
  }

  return seededShuffle(pairs, `${seed}:pairs`);
}

function buildCrossGroupPlayoffSlotMappingsFromEntries(params: {
  entries: GroupPlayoffEntry[];
  advancingPerGroup: number;
  bracketSize: number;
  seed: string;
}): GroupPlayoffSlotMapping[] {
  const entriesByRank = new Map<number, GroupPlayoffEntry[]>();

  for (const entry of params.entries) {
    entriesByRank.set(entry.rank, [...(entriesByRank.get(entry.rank) ?? []), entry]);
  }

  const pairs: Array<readonly [GroupPlayoffEntry | null, GroupPlayoffEntry | null]> = [];
  const mirroredRanksCount = Math.floor(params.advancingPerGroup / 2);

  for (let rank = 1; rank <= mirroredRanksCount; rank += 1) {
    const opponentRank = params.advancingPerGroup + 1 - rank;
    pairs.push(
      ...pairEntriesAcrossGroups(
        entriesByRank.get(rank) ?? [],
        entriesByRank.get(opponentRank) ?? [],
        `${params.seed}:rank:${rank}:${opponentRank}`,
      ),
    );
  }

  if (params.advancingPerGroup % 2 === 1) {
    const middleRank = Math.ceil(params.advancingPerGroup / 2);
    const middleEntries = seededShuffle(entriesByRank.get(middleRank) ?? [], `${params.seed}:rank:${middleRank}:middle`);
    for (let index = 0; index < middleEntries.length; index += 2) {
      pairs.push([middleEntries[index] ?? null, middleEntries[index + 1] ?? null]);
    }
  }

  const maxPairs = params.bracketSize / 2;
  while (pairs.length < maxPairs) {
    pairs.push([null, null]);
  }

  return pairs.slice(0, maxPairs).flatMap(([first, second], index) => [
    {
      round: 1,
      matchNumber: index + 1,
      slotNumber: 1,
      sourceRef: first ? createGroupSourceRef(first.groupId, first.rank) : undefined,
    } satisfies GroupPlayoffSlotMapping,
    {
      round: 1,
      matchNumber: index + 1,
      slotNumber: 2,
      sourceRef: second ? createGroupSourceRef(second.groupId, second.rank) : undefined,
    } satisfies GroupPlayoffSlotMapping,
  ]);
}

function buildCrossGroupPlayoffSlotMappings(params: {
  groups: Array<{
    id: string;
    orderIndex: number;
    standings: Array<{ rank: number | null }>;
  }>;
  advancingPerGroup: number;
  bracketSize: number;
  seed: string;
}): GroupPlayoffSlotMapping[] {
  const entries = params.groups.flatMap((group) =>
    group.standings
      .filter((standing) => standing.rank && standing.rank <= params.advancingPerGroup)
      .map((standing) => ({
        groupId: group.id,
        groupOrder: group.orderIndex,
        rank: standing.rank!,
      })),
  );

  return buildCrossGroupPlayoffSlotMappingsFromEntries({
    entries,
    advancingPerGroup: params.advancingPerGroup,
    bracketSize: params.bracketSize,
    seed: params.seed,
  });
}

function buildCrossGroupPlayoffSlotMappingsFromRefs(params: {
  groups: Array<{ id: string; orderIndex: number }>;
  sourceRefs: string[];
  bracketSize: number;
  seed: string;
}): GroupPlayoffSlotMapping[] {
  const groupOrderById = new Map(params.groups.map((group) => [group.id, group.orderIndex]));
  const entries = params.sourceRefs
    .map((sourceRef) => {
      const parsed = parseGroupSourceRef(sourceRef);
      if (!parsed) return null;

      return {
        groupId: parsed.groupId,
        groupOrder: groupOrderById.get(parsed.groupId) ?? 999,
        rank: parsed.rank,
      } satisfies GroupPlayoffEntry;
    })
    .filter(Boolean) as GroupPlayoffEntry[];
  const advancingPerGroup = entries.reduce((maxRank, entry) => Math.max(maxRank, entry.rank), 0);

  if (advancingPerGroup < 2) {
    return params.sourceRefs.map((sourceRef, index) => ({
      round: 1,
      matchNumber: Math.floor(index / 2) + 1,
      slotNumber: (index % 2) + 1 === 1 ? 1 : 2,
      sourceRef,
    }));
  }

  return buildCrossGroupPlayoffSlotMappingsFromEntries({
    entries,
    advancingPerGroup,
    bracketSize: params.bracketSize,
    seed: params.seed,
  });
}

function isValidCrossGroupPlayoffMapping(
  mappings: Array<{ matchNumber: number; slotNumber: number; sourceRef: string | null }>,
  advancingPerGroup: number,
) {
  if (!mappings.length) return false;

  const byMatch = new Map<number, Array<{ slotNumber: number; sourceRef: string | null }>>();
  for (const mapping of mappings) {
    byMatch.set(mapping.matchNumber, [...(byMatch.get(mapping.matchNumber) ?? []), mapping]);
  }

  for (const matchSlots of Array.from(byMatch.values())) {
    const parsedSlots = matchSlots
      .sort((a: { slotNumber: number }, b: { slotNumber: number }) => a.slotNumber - b.slotNumber)
      .map((slot: { sourceRef: string | null }) => parseGroupSourceRef(slot.sourceRef))
      .filter(Boolean) as Array<{ groupId: string; rank: number }>;

    if (parsedSlots.length < 2) continue;

    const [first, second] = parsedSlots;
    if (first.groupId === second.groupId) return false;

    const expectedRankSum = advancingPerGroup + 1;
    const middleRank = advancingPerGroup % 2 === 1 ? Math.ceil(advancingPerGroup / 2) : null;
    const isMiddleRankPair = middleRank && first.rank === middleRank && second.rank === middleRank;
    if (!isMiddleRankPair && first.rank + second.rank !== expectedRankSum) return false;
  }

  return true;
}

function getGroupsPlayoffQualifiedCount(tournament: {
  participants: unknown[];
  groupsCount: number | null;
  playoffTeamsPerGroup: number | null;
}) {
  const groupsCount = tournament.groupsCount ?? Math.max(1, Math.floor(Math.sqrt(Math.max(tournament.participants.length, 1))));
  const advancingPerGroup = tournament.playoffTeamsPerGroup ?? 2;

  return Math.max(2, Math.min(tournament.participants.length, groupsCount * advancingPerGroup));
}

function getDefaultPlayoffSize(tournament: {
  format: TournamentFormat;
  participants: unknown[];
  groupsCount: number | null;
  playoffTeamsPerGroup: number | null;
}) {
  if (tournament.format === TournamentFormat.GROUPS_PLAYOFF) {
    return nextPowerOfTwo(getGroupsPlayoffQualifiedCount(tournament));
  }

  return nextPowerOfTwo(Math.max(tournament.participants.length, 2));
}

function resolveGroupsAdvancingPerGroup(params: {
  groupStageValue?: number | null;
  tournamentValue?: number | null;
  bracketSize: number;
  groupsCount: number;
}) {
  const configured = params.groupStageValue ?? params.tournamentValue;
  if (configured) return Math.max(1, Math.min(configured, 8));

  if (params.groupsCount > 0) {
    return Math.max(1, Math.min(Math.floor(params.bracketSize / params.groupsCount), 8));
  }

  return 2;
}

function createSeriesKey(bracketId: string, bracket: string, round: number, matchNumber: number, kind: "main" | "third-place" = "main") {
  return `${bracketId}:${bracket}:${round}:${matchNumber}:${kind}`;
}

function getMatchWinnerAndLoser(match: {
  player1Id: string | null;
  player2Id: string | null;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
  winnerId: string | null;
}) {
  const winnerEntryId = match.winnerId === match.player1Id ? match.participant1EntryId : match.winnerId === match.player2Id ? match.participant2EntryId : null;
  const loserId = match.winnerId === match.player1Id ? match.player2Id : match.winnerId === match.player2Id ? match.player1Id : null;
  const loserEntryId =
    match.winnerId === match.player1Id ? match.participant2EntryId : match.winnerId === match.player2Id ? match.participant1EntryId : null;

  return { winnerEntryId, loserId, loserEntryId };
}

async function assignParticipantToSeries(params: {
  matchId: string;
  slot: 1 | 2;
  userId: string | null;
  entryId: string | null;
}) {
  const seedMatch = await db.match.findUnique({
    where: { id: params.matchId },
    select: {
      id: true,
      seriesKey: true,
      isPenaltyTiebreak: true,
      player1Id: true,
      player2Id: true,
    },
  });

  if (!seedMatch) {
    throw new Error("Match not found");
  }

  const targetMatches = seedMatch.seriesKey
    ? await db.match.findMany({
        where: {
          seriesKey: seedMatch.seriesKey,
          isPenaltyTiebreak: false,
        },
        select: { id: true, player1Id: true, player2Id: true, status: true },
      })
    : [{ id: seedMatch.id, player1Id: seedMatch.player1Id, player2Id: seedMatch.player2Id, status: MatchStatus.PENDING }];

  for (const targetMatch of targetMatches) {
    const nextPlayer1Id = params.slot === 1 ? params.userId : targetMatch.player1Id;
    const nextPlayer2Id = params.slot === 2 ? params.userId : targetMatch.player2Id;
    const nextStatus =
      nextPlayer1Id && nextPlayer2Id && targetMatch.status === MatchStatus.PENDING
        ? MatchStatus.READY
        : nextPlayer1Id && nextPlayer2Id && targetMatch.status === MatchStatus.SCHEDULED
          ? MatchStatus.SCHEDULED
          : (!nextPlayer1Id || !nextPlayer2Id) && (targetMatch.status === MatchStatus.READY || targetMatch.status === MatchStatus.SCHEDULED)
            ? MatchStatus.PENDING
            : targetMatch.status;

    await db.match.update({
      where: { id: targetMatch.id },
      data: {
        ...(params.slot === 1
          ? { player1Id: params.userId, participant1EntryId: params.entryId }
          : { player2Id: params.userId, participant2EntryId: params.entryId }),
        ...(!nextPlayer1Id || !nextPlayer2Id
          ? {
              winnerId: null,
              winnerEntryId: null,
              player1Score: null,
              player2Score: null,
              finishedAt: null,
              notes: null,
            }
          : {}),
        status: nextStatus,
      },
    });

    if (nextPlayer1Id && nextPlayer2Id) {
      await notifyMatchReady(targetMatch.id);
    }
  }
}

async function advanceResolvedWinnerForMatch(matchId: string, winnerId: string, loserId?: string | null, winnerEntryId?: string | null, loserEntryId?: string | null) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      tournamentId: true,
      nextMatchId: true,
      nextMatchSlot: true,
      loserNextMatchId: true,
      loserNextMatchSlot: true,
    },
  });

  if (!match) {
    throw new Error("Match not found");
  }

  if (match.nextMatchId && match.nextMatchSlot) {
    await assignParticipantToSeries({
      matchId: match.nextMatchId,
      slot: match.nextMatchSlot as 1 | 2,
      userId: winnerId,
      entryId: winnerEntryId ?? null,
    });
  }

  if (match.loserNextMatchId && match.loserNextMatchSlot && loserId) {
    await assignParticipantToSeries({
      matchId: match.loserNextMatchId,
      slot: match.loserNextMatchSlot as 1 | 2,
      userId: loserId,
      entryId: loserEntryId ?? null,
    });
  }

  await prepareCaptainAssignedTeamMatchSlots(match.tournamentId);

  await syncTournamentLifecycleStatus(match.tournamentId);
}

async function clearAutoByeAdvance(match: {
  nextMatchId: string | null;
  nextMatchSlot: number | null;
  winnerEntryId: string | null;
}) {
  if (!match.nextMatchId || !match.nextMatchSlot || !match.winnerEntryId) return;

  const nextMatch = await db.match.findUnique({
    where: { id: match.nextMatchId },
    select: {
      id: true,
      seriesKey: true,
      participant1EntryId: true,
      participant2EntryId: true,
      status: true,
    },
  });

  if (!nextMatch || TERMINAL_MATCH_STATUSES.has(nextMatch.status)) return;

  const targetEntryId = match.nextMatchSlot === 1 ? nextMatch.participant1EntryId : nextMatch.participant2EntryId;
  if (targetEntryId !== match.winnerEntryId) return;

  await assignParticipantToSeries({
    matchId: nextMatch.id,
    slot: match.nextMatchSlot as 1 | 2,
    userId: null,
    entryId: null,
  });
}

async function resetAutoByeMatch(match: {
  id: string;
  seriesKey: string | null;
  nextMatchId: string | null;
  nextMatchSlot: number | null;
  winnerEntryId: string | null;
  status?: MatchStatus;
}) {
  await clearAutoByeAdvance(match);

  const where = match.seriesKey ? { seriesKey: match.seriesKey, isPenaltyTiebreak: false } : { id: match.id };
  await db.match.updateMany({
    where,
    data: {
      winnerId: null,
      winnerEntryId: null,
      player1Score: null,
      player2Score: null,
      finishedAt: null,
      notes: null,
      status: match.status ?? MatchStatus.PENDING,
    },
  });
}

async function reconcileBracketByes(bracketId: string) {
  const matches = await db.match.findMany({
    where: {
      bracketId,
      bracket: "upper",
      round: 1,
      isThirdPlaceMatch: false,
      isPenaltyTiebreak: false,
    },
    orderBy: [{ matchNumber: "asc" }, { legNumber: "asc" }],
    select: {
      id: true,
      seriesKey: true,
      legNumber: true,
      player1Id: true,
      player2Id: true,
      participant1EntryId: true,
      participant2EntryId: true,
      winnerId: true,
      winnerEntryId: true,
      status: true,
      notes: true,
      nextMatchId: true,
      nextMatchSlot: true,
    },
  });

  const grouped = new Map<string, Array<(typeof matches)[number]>>();
  for (const match of matches) {
    const key = match.seriesKey ?? match.id;
    grouped.set(key, [...(grouped.get(key) ?? []), match]);
  }

  for (const seriesMatches of Array.from(grouped.values())) {
    const match = seriesMatches.find((item) => (item.legNumber ?? 1) === 1) ?? seriesMatches[0];
    if (!match || (match.status !== MatchStatus.PENDING && match.status !== MatchStatus.READY && match.notes !== AUTO_BYE_NOTE)) continue;

    const first = match.player1Id
      ? { userId: match.player1Id, entryId: match.participant1EntryId }
      : null;
    const second = match.player2Id
      ? { userId: match.player2Id, entryId: match.participant2EntryId }
      : null;
    const byeWinner = first && !second ? first : second && !first ? second : null;

    if (!byeWinner) {
      if (match.notes === AUTO_BYE_NOTE) {
        await resetAutoByeMatch({ ...match, status: first && second ? MatchStatus.READY : MatchStatus.PENDING });
      }
      continue;
    }

    if (match.notes === AUTO_BYE_NOTE && match.winnerId === byeWinner.userId) continue;

    if (match.notes === AUTO_BYE_NOTE) {
      await clearAutoByeAdvance(match);
    }

    const where = match.seriesKey ? { seriesKey: match.seriesKey, isPenaltyTiebreak: false } : { id: match.id };
    await db.match.updateMany({
      where,
      data: {
        winnerId: byeWinner.userId,
        winnerEntryId: byeWinner.entryId,
        player1Score: 0,
        player2Score: 0,
        finishedAt: new Date(),
        notes: AUTO_BYE_NOTE,
        status: MatchStatus.CONFIRMED,
      },
    });

    await advanceResolvedWinnerForMatch(match.id, byeWinner.userId, null, byeWinner.entryId);
  }
}

function isPowerOfTwo(value: number) {
  return value >= 2 && (value & (value - 1)) === 0;
}

function isDirectPlayoffFormat(format: TournamentFormat) {
  return format === TournamentFormat.SINGLE_ELIMINATION || format === TournamentFormat.DOUBLE_ELIMINATION;
}

function isCustomDirectPlayoff(format: TournamentFormat, blueprintJson: unknown) {
  return format === TournamentFormat.CUSTOM && normalizeFormatBlueprint(blueprintJson).openingStageMode === "NONE";
}

function getStageStatus(hasPreviousStages: boolean, tournamentStatus: TournamentStatus) {
  if (hasPreviousStages) return StageStatus.PENDING;
  return tournamentStatus === TournamentStatus.IN_PROGRESS ? StageStatus.ACTIVE : StageStatus.PENDING;
}

function countSelectionEntries(selections: PlayoffSelectionRule[], targetBracket?: "upper" | "lower") {
  return selections
    .filter((selection) => !targetBracket || selection.targetBracket === targetBracket)
    .reduce((total, selection) => total + Math.max(0, selection.toRank - selection.fromRank + 1), 0);
}

function expandSelectionRefs(groups: { id: string; orderIndex: number }[], selections: PlayoffSelectionRule[], targetBracket: "upper" | "lower") {
  return selections
    .filter((selection) => selection.targetBracket === targetBracket)
    .flatMap((selection) => {
      const group = groups.find((item) => item.orderIndex === selection.divisionIndex);
      if (!group) return [];

      return Array.from({ length: Math.max(0, selection.toRank - selection.fromRank + 1) }, (_, index) =>
        createGroupSourceRef(group.id, selection.fromRank + index),
      );
    });
}

function parseCustomBracketSettings(value: unknown): CustomPlayoffSettings | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Partial<CustomPlayoffSettings>;
  if (data.mode !== "custom" || !Array.isArray(data.selections)) return null;

  return {
    mode: "custom",
    selections: data.selections,
    upperEntriesCount: Math.max(0, Number(data.upperEntriesCount ?? 0) || 0),
    lowerEntriesCount: Math.max(0, Number(data.lowerEntriesCount ?? 0) || 0),
  };
}

function getPlayerName(user?: { name?: string | null; telegramUsername?: string | null; email?: string | null } | null) {
  return user?.name ?? (user?.telegramUsername ? `@${user.telegramUsername}` : null) ?? user?.email ?? "соперник";
}

function formatMatchDescriptor(match: { round: number; matchNumber: number; legNumber?: number | null; isPenaltyTiebreak?: boolean }) {
  const parts = [`раунд ${match.round}`, `матч ${match.matchNumber}`];

  if (match.legNumber && match.legNumber > 1) {
    parts.push(`${match.legNumber}-я игра серии`);
  }

  if (match.isPenaltyTiebreak) {
    parts.push("серия пенальти");
  }

  return parts.join(", ");
}

function formatScheduleDate(value?: Date | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function roundUnitForStage(stageType: StageType) {
  return stageType === StageType.PLAYOFF ? "Раунд" : "Тур";
}

function buildRoundStartTitle(stageType: StageType, round: number) {
  return `${roundUnitForStage(stageType)} ${round} начался`;
}

function buildRoundStartBody(params: {
  tournamentTitle: string;
  stageName: string;
  stageType: StageType;
  round: number;
  matchesCount: number;
  deadlineAt: Date;
}) {
  const unit = roundUnitForStage(params.stageType).toLowerCase();
  const deadline = formatScheduleDate(params.deadlineAt);

  return [
    `${params.tournamentTitle}: ${params.stageName}, ${unit} ${params.round} открыт.`,
    `Матчей в этом ${unit === "тур" ? "туре" : "раунде"}: ${params.matchesCount}.`,
    `Дедлайн: ${deadline} МСК.`,
    "Откройте турнир и сыграйте матч до дедлайна.",
  ].join("\n");
}

type DeadlineReminderTier = {
  key: string;
  windowMs: number;
  title: string;
  lead: string;
  statusLabel: string;
};

// Tiers are ordered most-urgent first. Each cron run fires the most urgent tier
// whose window the deadline has entered but that hasn't been sent yet.
const DEADLINE_REMINDER_TIERS: DeadlineReminderTier[] = [
  {
    key: "1h",
    windowMs: 60 * 60 * 1000,
    title: "До дедлайна остался 1 час",
    lead: "до дедлайна остался примерно 1 час.",
    statusLabel: "До дедлайна меньше 1 часа",
  },
  {
    key: "6h",
    windowMs: 6 * 60 * 60 * 1000,
    title: "Дедлайн через 6 часов",
    lead: "до дедлайна осталось меньше 6 часов.",
    statusLabel: "До дедлайна менее 6 часов",
  },
  {
    key: "24h",
    windowMs: 24 * 60 * 60 * 1000,
    title: "Матч нужно сыграть до завтра",
    lead: "матч нужно сыграть до завтра — дедлайн менее чем через сутки.",
    statusLabel: "До дедлайна менее суток",
  },
];

function formatDeadlineReminderBody(params: {
  tournamentTitle: string;
  stageName: string;
  stageType: StageType;
  round: number;
  opponentName: string;
  deadlineAt: Date;
  lead: string;
}) {
  const unit = roundUnitForStage(params.stageType).toLowerCase();
  const deadline = formatScheduleDate(params.deadlineAt);

  return [
    `${params.tournamentTitle}: ${params.lead}`,
    `${params.stageName}, ${unit} ${params.round}. Соперник: ${params.opponentName}.`,
    `Дедлайн: ${deadline} МСК.`,
  ].join("\n");
}

export async function notifyActiveTournamentRoundsStarted(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      title: true,
      status: true,
      notificationsEnabled: true,
      stages: {
        where: { status: StageStatus.ACTIVE },
        select: {
          id: true,
          name: true,
          type: true,
          orderIndex: true,
          deadlines: {
            select: {
              round: true,
              deadlineAt: true,
            },
          },
          matches: {
            where: {
              isPenaltyTiebreak: false,
              player1Id: { not: null },
              player2Id: { not: null },
            },
            select: {
              id: true,
              round: true,
              status: true,
              player1Id: true,
              player2Id: true,
            },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament || tournament.status !== TournamentStatus.IN_PROGRESS || !tournamentNotificationsEnabled(tournament)) return;

  for (const stage of tournament.stages) {
    const deadlineByRound = new Map(stage.deadlines.map((deadline) => [deadline.round, deadline.deadlineAt]));
    const rounds = Array.from(new Set(stage.matches.map((match) => match.round))).sort((a, b) => a - b);
    const currentRound = rounds.find((round) => {
      if (!deadlineByRound.has(round)) return false;

      const roundMatches = stage.matches.filter((match) => match.round === round);
      if (!roundMatches.some((match) => !TERMINAL_MATCH_STATUSES.has(match.status))) return false;

      const previousMatches = stage.matches.filter((match) => match.round < round);
      return previousMatches.every((match) => TERMINAL_MATCH_STATUSES.has(match.status));
    });

    if (!currentRound) continue;

    const deadlineAt = deadlineByRound.get(currentRound);
    if (!deadlineAt) continue;

    const roundMatches = stage.matches.filter((match) => match.round === currentRound);
    const activeRoundMatches = roundMatches.filter((match) => !TERMINAL_MATCH_STATUSES.has(match.status));
    const userIds = activeRoundMatches.flatMap((match) => [match.player1Id, match.player2Id]).filter(Boolean) as string[];

    if (!userIds.length) continue;

    await createNotificationsForUsers({
      userIds,
      title: buildRoundStartTitle(stage.type, currentRound),
      body: buildRoundStartBody({
        tournamentTitle: tournament.title,
        stageName: stage.name,
        stageType: stage.type,
        round: currentRound,
        matchesCount: activeRoundMatches.length,
        deadlineAt,
      }),
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${tournament.id}`,
      dedupeKey: `tournament-round-start:${tournament.id}:${stage.id}:${currentRound}`,
      dedupeWithinHours: 24 * 365,
    });
  }
}

type TournamentChangeSnapshot = {
  startsAt: Date | null;
  rules: string | null;
  prizePool: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
};

function normalizeRulesText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePrizePoolText(value: string | null) {
  return (value ?? "").trim();
}

// Diffs a tournament's before/after snapshots into human-readable change lines.
// Returns an empty array when nothing meaningful changed so callers can skip sending.
function buildTournamentChangeLines(before: TournamentChangeSnapshot, after: TournamentChangeSnapshot) {
  const lines: string[] = [];

  const beforeStart = before.startsAt?.getTime() ?? null;
  const afterStart = after.startsAt?.getTime() ?? null;
  if (beforeStart !== afterStart) {
    const from = before.startsAt ? `${formatScheduleDate(before.startsAt)} МСК` : "не назначено";
    const to = after.startsAt ? `${formatScheduleDate(after.startsAt)} МСК` : "не назначено";
    lines.push(`Старт перенесён: ${from} → ${to}.`);
  }

  if (after.status !== before.status) {
    if (after.status === TournamentStatus.COMPLETED) {
      lines.push("Турнир завершён.");
    } else {
      lines.push(`Статус турнира изменён: ${tournamentStatusLabel[before.status]} → ${tournamentStatusLabel[after.status]}.`);
    }
  }

  if (after.format !== before.format) {
    lines.push(`Изменился формат турнира: ${tournamentFormatLabel[before.format]} → ${tournamentFormatLabel[after.format]}.`);
  }

  if (normalizePrizePoolText(before.prizePool) !== normalizePrizePoolText(after.prizePool)) {
    lines.push(after.prizePool ? `Обновлён призовой фонд: ${after.prizePool.trim()}.` : "Призовой фонд убран.");
  }

  if (normalizeRulesText(before.rules) !== normalizeRulesText(after.rules)) {
    lines.push("Регламент изменён — проверьте обновлённые правила.");
  }

  return lines;
}

// Sends ONE combined notification to confirmed participants summarizing all changes,
// so several edits in a single save don't spam multiple messages.
export async function notifyTournamentChanges(params: {
  tournamentId: string;
  title: string;
  notificationsEnabled: boolean;
  before: TournamentChangeSnapshot;
  after: TournamentChangeSnapshot;
}) {
  if (!params.notificationsEnabled) return { notifiedCount: 0 };

  const changeLines = buildTournamentChangeLines(params.before, params.after);
  if (!changeLines.length) return { notifiedCount: 0 };

  const participants = await db.tournamentRegistration.findMany({
    where: { tournamentId: params.tournamentId, status: ParticipantStatus.CONFIRMED },
    select: { userId: true },
  });
  const userIds = participants.map((participant) => participant.userId).filter(Boolean);
  if (!userIds.length) return { notifiedCount: 0 };

  const body = [`${params.title}:`, ...changeLines].join("\n");
  // Dedupe on the exact change set within a short window so a double-save doesn't double-send,
  // while genuinely new changes later still notify.
  await createNotificationsForUsers({
    userIds,
    title: "Изменения в турнире",
    body,
    type: NotificationType.TOURNAMENT,
    link: `/tournaments/${params.tournamentId}`,
    dedupeWithinHours: 6,
  });

  return { notifiedCount: userIds.length };
}

export async function autoAssignExpiredCaptainTeamMatchSlots(now = new Date()) {
  const tournaments = await db.tournament.findMany({
    where: {
      status: TournamentStatus.IN_PROGRESS,
      participantMode: TournamentParticipantMode.TEAM,
      captainsCreateTeamMatches: true,
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      notificationsEnabled: true,
      stages: {
        where: { status: StageStatus.ACTIVE },
        select: {
          id: true,
          startsAt: true,
          updatedAt: true,
          matches: {
            where: { isPenaltyTiebreak: false },
            select: {
              id: true,
              round: true,
              matchNumber: true,
              status: true,
              startsAt: true,
              scheduledAt: true,
              finishedAt: true,
              updatedAt: true,
              player1Id: true,
              player2Id: true,
              participant1EntryId: true,
              participant2EntryId: true,
              isCaptainAssignedTeamMatch: true,
              isTeamCaptainTiebreak: true,
              groupId: true,
              bracketId: true,
              legNumber: true,
              seriesKey: true,
            },
          },
        },
      },
    },
  });

  let assignedCount = 0;
  let notifiedCount = 0;

  for (const tournament of tournaments) {
    let tournamentChanged = false;

    for (const stage of tournament.stages) {
      const activeRound = resolveActiveCaptainTeamRound({
        matches: stage.matches,
        tournamentStartsAt: tournament.startsAt,
        stageStartsAt: stage.startsAt,
        stageActivatedAt: stage.updatedAt,
      });
      if (!activeRound || now.getTime() - activeRound.startedAt.getTime() < CAPTAIN_TEAM_AUTO_ASSIGNMENT_DELAY_MS) {
        continue;
      }

      const roundMatches = stage.matches.filter((match) => match.round === activeRound.round);
      const fixtureGroups = new Map<string, typeof roundMatches>();

      for (const match of roundMatches) {
        if (
          !match.isCaptainAssignedTeamMatch ||
          match.isTeamCaptainTiebreak ||
          !match.participant1EntryId ||
          !match.participant2EntryId
        ) {
          continue;
        }

        const key = JSON.stringify([
          match.groupId,
          match.bracketId,
          match.round,
          match.matchNumber,
          match.legNumber,
          match.seriesKey,
          match.participant1EntryId,
          match.participant2EntryId,
        ]);
        fixtureGroups.set(key, [...(fixtureGroups.get(key) ?? []), match]);
      }

      for (const fixtureMatches of fixtureGroups.values()) {
        if (!fixtureMatches.some((match) => (!match.player1Id || !match.player2Id) && match.status === MatchStatus.PENDING)) {
          continue;
        }

        const fixture = fixtureMatches[0];
        const result = await db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`captain-team-assignment:${tournament.id}`}))`;

          const freshSlots = await tx.match.findMany({
            where: { id: { in: fixtureMatches.map((match) => match.id) } },
            select: { id: true, player1Id: true, player2Id: true, status: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          });
          const occupiedMatches = await tx.match.findMany({
            where: {
              tournamentId: tournament.id,
              stageId: stage.id,
              groupId: fixture.groupId,
              bracketId: fixture.bracketId,
              round: activeRound.round,
              legNumber: fixture.legNumber,
              id: { notIn: fixtureMatches.map((match) => match.id) },
              OR: [{ player1Id: { not: null } }, { player2Id: { not: null } }],
            },
            select: { player1Id: true, player2Id: true },
          });
          const registrations = await tx.tournamentRegistration.findMany({
            where: { id: { in: [fixture.participant1EntryId!, fixture.participant2EntryId!] } },
            select: {
              id: true,
              rosterMembers: {
                where: { status: TeamInviteStatus.ACCEPTED },
                select: { userId: true, isCaptain: true },
              },
            },
          });
          const home = registrations.find((registration) => registration.id === fixture.participant1EntryId);
          const away = registrations.find((registration) => registration.id === fixture.participant2EntryId);
          if (!home || !away) return { matchIds: [] as string[], captainIds: [] as string[] };

          const assignments = buildRandomCaptainTeamAssignments({
            slots: freshSlots,
            homeUserIds: home.rosterMembers.map((member) => member.userId),
            awayUserIds: away.rosterMembers.map((member) => member.userId),
            occupiedUserIds: occupiedMatches.flatMap((match) => [match.player1Id, match.player2Id]).filter(Boolean) as string[],
          });
          const matchIds: string[] = [];

          for (const assignment of assignments) {
            const update = await tx.match.updateMany({
              where: {
                id: assignment.matchId,
                status: MatchStatus.PENDING,
                player1Id: assignment.previousPlayer1Id,
                player2Id: assignment.previousPlayer2Id,
              },
              data: {
                player1Id: assignment.player1Id,
                player2Id: assignment.player2Id,
                status: MatchStatus.READY,
              },
            });
            if (update.count === 1) matchIds.push(assignment.matchId);
          }

          return {
            matchIds,
            captainIds: [...home.rosterMembers, ...away.rosterMembers]
              .filter((member) => member.isCaptain)
              .map((member) => member.userId),
          };
        });

        if (!result.matchIds.length) continue;
        assignedCount += result.matchIds.length;
        tournamentChanged = true;
        invalidateTournamentSchedule(tournament.id);
        await Promise.all(result.matchIds.map((matchId) => notifyMatchReady(matchId)));

        if (tournamentNotificationsEnabled(tournament) && result.captainIds.length) {
          const captainIds = Array.from(new Set(result.captainIds));
          await createNotificationsForUsers({
            userIds: captainIds,
            title: "Пары назначены автоматически",
            body: `${tournament.title}: срок ручного назначения в 8 часов истёк, оставшиеся пары тура/раунда ${activeRound.round} распределены случайно.`,
            type: NotificationType.MATCH,
            link: `/tournaments/${tournament.id}?tab=my-matches`,
            dedupeKey: `captain-team-auto-assignment:${fixture.id}`,
            dedupeWithinHours: 24 * 365,
          });
          notifiedCount += captainIds.length;
        }
      }
    }

    if (tournamentChanged) invalidateTournamentSchedule(tournament.id);
  }

  return { assignedCount, notifiedCount };
}

export async function notifyUpcomingRoundDeadlineReminders({ userId }: { userId?: string } = {}) {
  const now = new Date();
  // Widen to the largest tier window (24h) so every tier can be evaluated in one pass.
  const widestWindowMs = Math.max(...DEADLINE_REMINDER_TIERS.map((tier) => tier.windowMs));
  const reminderWindowEnd = new Date(now.getTime() + widestWindowMs);
  const deadlines = await db.roundDeadline.findMany({
    where: {
      deadlineAt: {
        gt: now,
        lte: reminderWindowEnd,
      },
      tournament: {
        status: TournamentStatus.IN_PROGRESS,
        notificationsEnabled: true,
      },
    },
    select: {
      id: true,
      round: true,
      deadlineAt: true,
      tournament: {
        select: {
          id: true,
          title: true,
          notificationsEnabled: true,
          captainsCreateTeamMatches: true,
        },
      },
      stage: {
        select: {
          id: true,
          name: true,
          type: true,
          matches: {
            where: {
              isPenaltyTiebreak: false,
              status: { notIn: Array.from(TERMINAL_MATCH_STATUSES) },
            },
            select: {
              id: true,
              round: true,
              player1Id: true,
              player2Id: true,
              isCaptainAssignedTeamMatch: true,
              player1: { select: { name: true, email: true } },
              player2: { select: { name: true, email: true } },
              participant1Entry: {
                select: {
                  id: true,
                  rosterMembers: {
                    where: { isCaptain: true, status: TeamInviteStatus.ACCEPTED },
                    select: { userId: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { deadlineAt: "asc" },
  });

  let notifiedCount = 0;

  for (const deadline of deadlines) {
    if (!tournamentNotificationsEnabled(deadline.tournament)) continue;

    if (deadline.tournament.captainsCreateTeamMatches) {
      const reminderBucket = Math.floor(now.getTime() / (30 * 60 * 1_000));
      const unassignedByCaptainId = new Map<string, number>();
      for (const match of deadline.stage.matches) {
        if (
          match.round !== deadline.round ||
          !match.isCaptainAssignedTeamMatch ||
          match.player1Id ||
          match.player2Id
        ) {
          continue;
        }
        for (const captain of match.participant1Entry?.rosterMembers ?? []) {
          if (!userId || captain.userId === userId) {
            unassignedByCaptainId.set(captain.userId, (unassignedByCaptainId.get(captain.userId) ?? 0) + 1);
          }
        }
      }

      for (const [captainId, unassignedCount] of unassignedByCaptainId) {
        await createNotification({
          userId: captainId,
          title: "Нужно назначить пары игроков",
          body: `${deadline.tournament.title}: до дедлайна осталось незаполненных пар: ${unassignedCount}.`,
          type: NotificationType.MATCH,
          link: `/tournaments/${deadline.tournament.id}?tab=my-matches`,
          dedupeKey: `captain-team-assignment:${deadline.id}:${captainId}:${reminderBucket}`,
          dedupeWithinHours: 24 * 365,
        });
        notifiedCount += 1;
      }
    }

    // Most-urgent tier the deadline has entered (tiers are ordered urgent-first).
    const msLeft = deadline.deadlineAt.getTime() - now.getTime();
    const tier = DEADLINE_REMINDER_TIERS.find((candidate) => msLeft <= candidate.windowMs);
    if (!tier) continue;

    const matches = deadline.stage.matches.filter(
      (match) => match.round === deadline.round && Boolean(match.player1Id && match.player2Id),
    );
    for (const match of matches) {
      const sides = [
        {
          userId: match.player1Id,
          opponentName: match.player2 ? getPlayerName(match.player2) : "соперник",
        },
        {
          userId: match.player2Id,
          opponentName: match.player1 ? getPlayerName(match.player1) : "соперник",
        },
      ].filter((side): side is { userId: string; opponentName: string } => Boolean(side.userId && (!userId || side.userId === userId)));

      for (const side of sides) {
        const matchPath = `/tournaments/${deadline.tournament.id}?tab=my-matches`;
        const baseUrl = getConfiguredSiteBaseUrl();
        await createNotification({
          userId: side.userId,
          title: tier.title,
          body: formatDeadlineReminderBody({
            tournamentTitle: deadline.tournament.title,
            stageName: deadline.stage.name,
            stageType: deadline.stage.type,
            round: deadline.round,
            opponentName: side.opponentName,
            deadlineAt: deadline.deadlineAt,
            lead: tier.lead,
          }),
          type: NotificationType.MATCH,
          link: matchPath,
          dedupeKey: `deadline-${tier.key}:${deadline.id}:${match.id}`,
          dedupeWithinHours: 24 * 365,
          telegramRichMessage: baseUrl
            ? withRemindLaterButton(
                buildPersonalMatchMessage({
                  tournamentTitle: deadline.tournament.title,
                  stageName: deadline.stage.name,
                  round: deadline.round,
                  opponentName: side.opponentName,
                  deadlineAt: deadline.deadlineAt,
                  statusLabel: tier.statusLabel,
                  headline: tier.title,
                  buttonLabel: "Открыть матч",
                  matchUrl: new URL(matchPath, baseUrl).toString(),
                }),
                match.id,
              )
            : undefined,
        });
        notifiedCount += 1;
      }
    }
  }

  return { notifiedCount };
}

export async function notifyMatchReady(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: true,
      player1: true,
      player2: true,
      schedules: {
        orderBy: { startsAt: "asc" },
        take: 1,
      },
    },
  });

  if (!match?.player1Id || !match.player2Id || !match.player1 || !match.player2) {
    return;
  }

  if (!tournamentNotificationsEnabled(match.tournament)) {
    return;
  }

  const scheduleDate = formatScheduleDate(match.scheduledAt ?? match.schedules[0]?.startsAt);
  const scheduleText = scheduleDate ? ` Время: ${scheduleDate}.` : "";
  const descriptor = formatMatchDescriptor(match);
  const deadline = match.stageId
    ? await db.roundDeadline.findUnique({ where: { stageId_round: { stageId: match.stageId, round: match.round } } })
    : null;
  const matchPath = `/tournaments/${match.tournamentId}?tab=my-matches`;
  const baseUrl = getConfiguredSiteBaseUrl();

  await Promise.all([
    createNotification({
      userId: match.player1Id,
      title: "Новый соперник",
      body: `${match.tournament.title}: ${descriptor}. Ваш соперник: ${getPlayerName(match.player2)}.${scheduleText}`,
      type: NotificationType.MATCH,
      link: `/tournaments/${match.tournamentId}`,
      dedupeKey: `match-ready:${match.id}`,
      dedupeWithinHours: 24 * 365,
      telegramRichMessage: baseUrl
        ? buildPersonalMatchMessage({
            tournamentTitle: match.tournament.title,
            stageName: descriptor,
            round: match.round,
            opponentName: getPlayerName(match.player2),
            scheduledAt: match.scheduledAt ?? match.schedules[0]?.startsAt,
            deadlineAt: deadline?.deadlineAt,
            statusLabel: "Матч готов к игре",
            matchUrl: new URL(matchPath, baseUrl).toString(),
          })
        : undefined,
    }),
    createNotification({
      userId: match.player2Id,
      title: "Новый соперник",
      body: `${match.tournament.title}: ${descriptor}. Ваш соперник: ${getPlayerName(match.player1)}.${scheduleText}`,
      type: NotificationType.MATCH,
      link: `/tournaments/${match.tournamentId}`,
      dedupeKey: `match-ready:${match.id}`,
      dedupeWithinHours: 24 * 365,
      telegramRichMessage: baseUrl
        ? buildPersonalMatchMessage({
            tournamentTitle: match.tournament.title,
            stageName: descriptor,
            round: match.round,
            opponentName: getPlayerName(match.player1),
            scheduledAt: match.scheduledAt ?? match.schedules[0]?.startsAt,
            deadlineAt: deadline?.deadlineAt,
            statusLabel: "Матч готов к игре",
            matchUrl: new URL(matchPath, baseUrl).toString(),
          })
        : undefined,
    }),
  ]);
}

async function notifyFirstRoundMatchesReady(tournamentId: string) {
  const matches = await db.match.findMany({
    where: {
      tournamentId,
      round: 1,
      player1Id: { not: null },
      player2Id: { not: null },
      status: { in: [MatchStatus.READY, MatchStatus.SCHEDULED] },
      isPenaltyTiebreak: false,
    },
    select: { id: true },
  });

  await Promise.all(matches.map((match) => notifyMatchReady(match.id)));
}

async function notifyPlayoffQualified(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      brackets: {
        include: {
          slots: {
            where: { round: 1, participantId: { not: null } },
            include: { participant: true },
          },
        },
      },
    },
  });

  if (!tournament || !tournamentNotificationsEnabled(tournament)) return;

  const qualifiedUserIds = tournament.brackets.flatMap((bracket) => bracket.slots.map((slot) => slot.participant?.userId).filter(Boolean) as string[]);

  await createNotificationsForUsers({
    userIds: qualifiedUserIds,
    title: "Вы вышли в плей-офф",
    body: `${tournament.title}: вы прошли дальше. Проверьте сетку и следующий матч.`,
    type: NotificationType.TOURNAMENT,
    link: `/tournaments/${tournament.id}`,
    dedupeWithinHours: 72,
  });
}

async function notifyTournamentCompleted(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        select: { userId: true },
      },
      matches: {
        where: {
          status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED] },
        },
        orderBy: [{ round: "desc" }, { updatedAt: "desc" }],
      },
    },
  });

  if (!tournament) return;

  const finalWinnerId = tournament.matches.find((match) => !match.isThirdPlaceMatch && match.winnerId)?.winnerId ?? null;

  if (finalWinnerId && !tournament.isTest) {
    await grantCurrentChampionProfileStatus({
      userId: finalWinnerId,
      tournamentTitle: tournament.title,
    });
  }

  await publishTournamentCompletion(tournamentId).catch((error) => {
    console.error("Failed to publish Telegram tournament completion", error);
  });

  if (!tournamentNotificationsEnabled(tournament)) return;

  const participantUserIds = tournament.participants.map((participant) => participant.userId);
  const otherUserIds = participantUserIds.filter((userId) => userId !== finalWinnerId);

  if (finalWinnerId) {
    await createNotification({
      userId: finalWinnerId,
      title: "Вы выиграли турнир",
      body: `${tournament.title}: поздравляем, вы победитель турнира.`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${tournament.id}`,
      dedupeWithinHours: 168,
    });
  }

  await createNotificationsForUsers({
    userIds: otherUserIds,
    title: "Турнир завершён",
    body: `${tournament.title}: турнир завершён. Итоги уже доступны на странице турнира.`,
    type: NotificationType.TOURNAMENT,
    link: `/tournaments/${tournament.id}`,
    dedupeWithinHours: 168,
  });
}

async function ensureGroupStandings(groupId: string, participantIds: string[]) {
  await db.$transaction([
    db.groupStanding.deleteMany({
      where: {
        groupId,
        participantId: { notIn: participantIds },
      },
    }),
    ...participantIds.map((participantId) =>
      db.groupStanding.upsert({
        where: { groupId_participantId: { groupId, participantId } },
        update: {},
        create: { groupId, participantId },
      }),
    ),
  ]);
}

export function getTournamentGroupCapacityLimit(tournament: {
  format: TournamentFormat;
  groupsCount?: number | null;
  participantsPerGroup?: number | null;
  formatBlueprintJson?: unknown;
}) {
  if (tournament.format === TournamentFormat.GROUPS || tournament.format === TournamentFormat.GROUPS_PLAYOFF) {
    return tournament.groupsCount && tournament.participantsPerGroup
      ? tournament.groupsCount * tournament.participantsPerGroup
      : null;
  }

  if (tournament.format !== TournamentFormat.CUSTOM) {
    return null;
  }

  const blueprint = normalizeFormatBlueprint(tournament.formatBlueprintJson);
  if (blueprint.openingStageMode === "NONE" || !blueprint.participantsPerGroup) {
    return null;
  }

  return blueprint.divisionsCount * blueprint.participantsPerGroup;
}

async function createRoundRobinMatchesForEntries({
  tournamentId,
  stageId,
  groupId,
  entries,
  roundsCount,
  roundsMode = "cycles",
  matchesPerOpponent,
  matchupFormat = MatchupFormat.SINGLE_MATCH,
  bestOfWins = 1,
}: {
  tournamentId: string;
  stageId?: string;
  groupId?: string;
  entries: { id: string; userId: string }[];
  roundsCount?: number | null;
  roundsMode?: "cycles" | "series";
  matchesPerOpponent?: number | null;
  matchupFormat?: MatchupFormat;
  bestOfWins?: number;
}) {
  const data: {
    tournamentId: string;
    stageId?: string;
    groupId?: string;
    round: number;
    matchNumber: number;
    participant1EntryId?: string;
    participant2EntryId?: string;
    player1Id?: string;
    player2Id?: string;
    seriesKey?: string;
    seriesWinsRequired?: number;
    seriesMatchNumber?: number;
    legNumber?: number;
    status: MatchStatus;
  }[] = [];

  let matchNumber = 1;
  let slots: ({ id: string; userId: string } | null)[] = entries.length % 2 === 0 ? [...entries] : [...entries, null];
  const roundsPerCycle = Math.max(slots.length - 1, 1);
  const requestedCount = Math.max(roundsCount ?? 1, 1);
  const requestedMatchesPerOpponent = Math.max(matchesPerOpponent ?? requestedCount, 1);
  const seriesWinsRequired = matchupFormat === MatchupFormat.BEST_OF ? Math.max(2, Math.min(bestOfWins, 9)) : null;
  const bestOfMatchesPerPair = seriesWinsRequired ? seriesWinsRequired * 2 - 1 : null;
  const matchesPerPair = bestOfMatchesPerPair ?? (roundsMode === "series" ? Math.min(requestedMatchesPerOpponent, 6) : 1);
  const totalTours = roundsMode === "series" ? requestedCount : requestedCount * roundsPerCycle;
  const maxMatchesPerPair = bestOfMatchesPerPair ?? (roundsMode === "series" ? matchesPerPair : requestedCount);
  const pairMatchesCount = new Map<string, number>();

  for (let tourIndex = 0; tourIndex < totalTours; tourIndex += 1) {
    const cycle = Math.floor(tourIndex / roundsPerCycle);
    const roundIndex = tourIndex % roundsPerCycle;

    for (let pairIndex = 0; pairIndex < slots.length / 2; pairIndex += 1) {
      const first = slots[pairIndex];
      const second = slots[slots.length - 1 - pairIndex];
      if (!first || !second) continue;

      for (let legIndex = 0; legIndex < matchesPerPair; legIndex += 1) {
        const shouldSwapHomeAway =
          roundsMode === "series" ? legIndex % 2 === 1 : (cycle + roundIndex + pairIndex) % 2 === 1;
        const participant1 = shouldSwapHomeAway ? second : first;
        const participant2 = shouldSwapHomeAway ? first : second;
        const pairKey = createEntryPairKey(participant1.id, participant2.id);
        const currentPairMatchesCount = pairMatchesCount.get(pairKey) ?? 0;

        if (currentPairMatchesCount >= maxMatchesPerPair) {
          continue;
        }

        pairMatchesCount.set(pairKey, currentPairMatchesCount + 1);

        data.push({
          tournamentId,
          stageId,
          groupId,
          round: tourIndex + 1,
          matchNumber: matchNumber++,
          seriesKey: seriesWinsRequired ? `group:${groupId ?? stageId ?? tournamentId}:${pairKey}:${tourIndex + 1}` : undefined,
          seriesWinsRequired: seriesWinsRequired ?? undefined,
          seriesMatchNumber: seriesWinsRequired ? legIndex + 1 : undefined,
          legNumber: seriesWinsRequired ? legIndex + 1 : undefined,
          participant1EntryId: participant1.id,
          participant2EntryId: participant2.id,
          player1Id: participant1.userId,
          player2Id: participant2.userId,
          status: MatchStatus.READY,
        });
      }
    }

    slots = [slots[0] ?? null, slots[slots.length - 1] ?? null, ...slots.slice(1, -1)];
  }

  if (data.length) {
    await db.match.createMany({ data });
  }
}

async function createPlayoffMatches({
  tournamentId,
  stageId,
  bracketId,
  entries,
  type,
  legsCount,
  thirdPlaceMatch,
  sizeOverride,
  matchupFormat = MatchupFormat.SINGLE_MATCH,
  bestOfWins = 1,
}: {
  tournamentId: string;
  stageId: string;
  bracketId: string;
  entries: { id: string; userId: string; seed: number | null }[];
  type: PlayoffType;
  legsCount: number;
  thirdPlaceMatch: boolean;
  sizeOverride?: number;
  matchupFormat?: MatchupFormat;
  bestOfWins?: number;
}) {
  const orderedEntries = [...entries].sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER));
  const bracketSize = sizeOverride && isPowerOfTwo(sizeOverride) ? sizeOverride : nextPowerOfTwo(orderedEntries.length);
  const firstRoundSlots = createFirstRoundSlotEntries(orderedEntries, bracketSize);
  const rounds = Math.log2(bracketSize);
  const seriesWinsRequired = matchupFormat === MatchupFormat.BEST_OF ? Math.max(2, Math.min(bestOfWins, 9)) : null;
  const effectiveLegsCount = seriesWinsRequired ? seriesWinsRequired * 2 - 1 : type === PlayoffType.DOUBLE ? 1 : Math.max(1, Math.min(legsCount, 2));
  const createdMatches: { id: string; round: number; matchNumber: number; legNumber: number; seriesKey: string }[] = [];

  for (let round = 1; round <= rounds; round += 1) {
    const count = bracketSize / Math.pow(2, round);
    for (let matchNumber = 1; matchNumber <= count; matchNumber += 1) {
      const seriesKey = createSeriesKey(bracketId, "upper", round, matchNumber);

      for (let legNumber = 1; legNumber <= effectiveLegsCount; legNumber += 1) {
        const created = await db.match.create({
          data: {
            tournamentId,
            stageId,
            bracketId,
            round,
            matchNumber,
            bracket: "upper",
            seriesKey,
            legNumber,
            seriesWinsRequired,
            seriesMatchNumber: seriesWinsRequired ? legNumber : null,
            status: MatchStatus.PENDING,
          },
        });
        createdMatches.push({ id: created.id, round, matchNumber, legNumber, seriesKey });
      }
    }
  }

  for (const match of createdMatches.filter((item) => item.round < rounds)) {
    const next = createdMatches.find(
      (item) => item.round === match.round + 1 && item.matchNumber === Math.ceil(match.matchNumber / 2) && item.legNumber === 1,
    );

    if (next) {
      await db.match.update({
        where: { id: match.id },
        data: {
          nextMatchId: next.id,
          nextMatchSlot: match.matchNumber % 2 === 1 ? 1 : 2,
        },
      });
    }
  }

  const firstRound = createdMatches.filter((item) => item.round === 1);
  if (orderedEntries.length) {
    await Promise.all(
      firstRound.filter((item) => item.legNumber === 1).map(async (match, index) => {
        const player1 = firstRoundSlots[index * 2];
        const player2 = firstRoundSlots[index * 2 + 1];
        const seriesMatches = createdMatches.filter((item) => item.seriesKey === match.seriesKey);

        await Promise.all(
          seriesMatches.map((seriesMatch) =>
            db.match.update({
              where: { id: seriesMatch.id },
              data: {
                participant1EntryId: player1?.id,
                participant2EntryId: player2?.id,
                player1Id: player1?.userId,
                player2Id: player2?.userId,
                status: player1 && player2 ? MatchStatus.READY : MatchStatus.PENDING,
              },
            }),
          ),
        );

        if (player1) {
          await db.bracketSlot.upsert({
            where: {
              bracketId_round_matchNumber_slotNumber: {
                bracketId,
                round: 1,
                matchNumber: match.matchNumber,
                slotNumber: 1,
              },
            },
            update: { participantId: player1.id, sourceType: "MANUAL" },
            create: {
              bracketId,
              round: 1,
              matchNumber: match.matchNumber,
              slotNumber: 1,
              participantId: player1.id,
              sourceType: "MANUAL",
            },
          });
        }

        if (player2) {
          await db.bracketSlot.upsert({
            where: {
              bracketId_round_matchNumber_slotNumber: {
                bracketId,
                round: 1,
                matchNumber: match.matchNumber,
                slotNumber: 2,
              },
            },
            update: { participantId: player2.id, sourceType: "MANUAL" },
            create: {
              bracketId,
              round: 1,
              matchNumber: match.matchNumber,
              slotNumber: 2,
              participantId: player2.id,
              sourceType: "MANUAL",
            },
          });
        }
      }),
    );

    await reconcileBracketByes(bracketId);
  }

  if (type === PlayoffType.DOUBLE) {
    await Promise.all(
      firstRound
        .filter((match) => match.legNumber === 1)
        .map((match) =>
        db.match.create({
          data: {
            tournamentId,
            stageId,
            bracketId,
            round: match.round,
            matchNumber: match.matchNumber,
            bracket: "lower",
            status: MatchStatus.PENDING,
          },
        }),
        ),
    );
  }

  if (thirdPlaceMatch && type !== PlayoffType.DOUBLE && rounds >= 2) {
    const semifinalLegs = createdMatches.filter((match) => match.round === rounds - 1 && match.legNumber === 1);
    const thirdPlaceSeriesKey = createSeriesKey(bracketId, "upper", rounds, 2, "third-place");
    const thirdPlaceMatches = await Promise.all(
      Array.from({ length: effectiveLegsCount }, (_, index) => {
        const legNumber = index + 1;

        return db.match.create({
          data: {
            tournamentId,
            stageId,
            bracketId,
            round: rounds,
            matchNumber: 2,
            bracket: "upper",
            seriesKey: thirdPlaceSeriesKey,
            legNumber,
            seriesWinsRequired,
            seriesMatchNumber: seriesWinsRequired ? legNumber : null,
            isThirdPlaceMatch: true,
            status: MatchStatus.PENDING,
          },
        });
      }),
    );
    const firstThirdPlaceMatch = thirdPlaceMatches[0];
    if (!firstThirdPlaceMatch) return;

    await Promise.all(
      semifinalLegs.slice(0, 2).map((semifinal, index) =>
        db.match.updateMany({
          where: { seriesKey: semifinal.seriesKey },
          data: {
            loserNextMatchId: firstThirdPlaceMatch.id,
            loserNextMatchSlot: index === 0 ? 1 : 2,
          },
        }),
      ),
    );
  }
}

async function ensureGroupsPlayoffBracketShape(params: {
  tournamentId: string;
  stageId: string;
  bracketId: string;
  type: PlayoffType;
  legsCount: number;
  thirdPlaceMatch: boolean;
  bracketSize: number;
  matchupFormat?: MatchupFormat;
  bestOfWins?: number;
}) {
  const existingMatches = await db.match.findMany({
    where: { bracketId: params.bracketId },
    select: { id: true, status: true },
  });
  const expectedRoundOneMatches = params.bracketSize / 2;
  const existingRoundOneMatches = await db.match.count({
    where: { bracketId: params.bracketId, round: 1, bracket: "upper", isThirdPlaceMatch: false, legNumber: 1 },
  });

  if (!existingMatches.length) {
    await db.playoffBracket.update({
      where: { id: params.bracketId },
      data: { size: params.bracketSize },
    });
    await db.tournamentStage.update({
      where: { id: params.stageId },
      data: { roundsCount: Math.log2(params.bracketSize) },
    });
    await createPlayoffMatches({
      tournamentId: params.tournamentId,
      stageId: params.stageId,
      bracketId: params.bracketId,
      entries: [],
      type: params.type,
      legsCount: params.legsCount,
      thirdPlaceMatch: params.thirdPlaceMatch,
      sizeOverride: params.bracketSize,
      matchupFormat: params.matchupFormat,
      bestOfWins: params.bestOfWins,
    });
    return;
  }

  await ensureThirdPlaceSeriesShape({
    tournamentId: params.tournamentId,
    stageId: params.stageId,
    bracketId: params.bracketId,
    rounds: Math.log2(params.bracketSize),
    thirdPlaceMatch: params.thirdPlaceMatch && params.type !== PlayoffType.DOUBLE,
    seriesWinsRequired: params.matchupFormat === MatchupFormat.BEST_OF ? Math.max(2, Math.min(params.bestOfWins ?? 1, 9)) : null,
  });

  if (existingRoundOneMatches === expectedRoundOneMatches) {
    return;
  }

  if (existingMatches.some((match) => TERMINAL_MATCH_STATUSES.has(match.status))) {
    throw new Error("Нельзя перестроить сетку плей-офф: в ней уже есть завершённые матчи.");
  }

  await db.matchResultSubmission.deleteMany({
    where: { match: { bracketId: params.bracketId } },
  });
  await db.matchSchedule.deleteMany({
    where: { match: { bracketId: params.bracketId } },
  });
  await db.match.deleteMany({
    where: { bracketId: params.bracketId },
  });
  await db.bracketSlot.deleteMany({
    where: { bracketId: params.bracketId },
  });
  await db.playoffBracket.update({
    where: { id: params.bracketId },
    data: { size: params.bracketSize },
  });
  await db.tournamentStage.update({
    where: { id: params.stageId },
    data: { roundsCount: Math.log2(params.bracketSize) },
  });

  await createPlayoffMatches({
    tournamentId: params.tournamentId,
    stageId: params.stageId,
    bracketId: params.bracketId,
    entries: [],
    type: params.type,
    legsCount: params.legsCount,
    thirdPlaceMatch: params.thirdPlaceMatch,
    sizeOverride: params.bracketSize,
    matchupFormat: params.matchupFormat,
    bestOfWins: params.bestOfWins,
  });
}

async function ensureThirdPlaceSeriesShape({
  tournamentId,
  stageId,
  bracketId,
  rounds,
  thirdPlaceMatch,
  seriesWinsRequired,
}: {
  tournamentId: string;
  stageId: string;
  bracketId: string;
  rounds: number;
  thirdPlaceMatch: boolean;
  seriesWinsRequired: number | null;
}) {
  if (!thirdPlaceMatch || !seriesWinsRequired || seriesWinsRequired <= 1 || rounds < 2) {
    return;
  }

  const seriesKey = createSeriesKey(bracketId, "upper", rounds, 2, "third-place");
  const expectedMatchesCount = seriesWinsRequired * 2 - 1;
  const existingThirdPlaceMatches = await db.match.findMany({
    where: {
      bracketId,
      seriesKey,
      isThirdPlaceMatch: true,
      isPenaltyTiebreak: false,
    },
    orderBy: [{ legNumber: "asc" }, { createdAt: "asc" }],
  });
  const existingLegNumbers = new Set(existingThirdPlaceMatches.map((match) => match.legNumber ?? 1));
  const referenceMatch = existingThirdPlaceMatches[0];

  for (let legNumber = 1; legNumber <= expectedMatchesCount; legNumber += 1) {
    if (existingLegNumbers.has(legNumber)) {
      continue;
    }

    await db.match.create({
      data: {
        tournamentId,
        stageId,
        bracketId,
        round: rounds,
        matchNumber: 2,
        bracket: "upper",
        seriesKey,
        legNumber,
        seriesWinsRequired,
        seriesMatchNumber: legNumber,
        isThirdPlaceMatch: true,
        participant1EntryId: referenceMatch?.participant1EntryId,
        participant2EntryId: referenceMatch?.participant2EntryId,
        player1Id: referenceMatch?.player1Id,
        player2Id: referenceMatch?.player2Id,
        status: referenceMatch?.player1Id && referenceMatch?.player2Id ? MatchStatus.READY : MatchStatus.PENDING,
      },
    });
  }
}

async function createCustomFormatStages(params: {
  tournamentId: string;
  tournament: {
    status: TournamentStatus;
    maxParticipants: number;
    pointsForWin: number;
    pointsForDraw: number;
    pointsForLoss: number;
    sortRules: import("@prisma/client").SortRule[];
  };
  blueprint: FormatBlueprint;
}) {
  const stages: TournamentStage[] = [];
  const hasOpeningStage = params.blueprint.openingStageMode !== "NONE";

  if (hasOpeningStage) {
    const participantsPerDivision =
      params.blueprint.participantsPerGroup ?? Math.max(2, Math.ceil(params.tournament.maxParticipants / params.blueprint.divisionsCount));
    const openingToursCount = params.blueprint.openingRoundsCount ?? getRoundRobinToursCount(participantsPerDivision);

    const leagueStage = await db.tournamentStage.create({
      data: {
        tournamentId: params.tournamentId,
        name: params.blueprint.leagueStageName,
        type: StageType.GROUP_STAGE,
        status: getStageStatus(false, params.tournament.status),
        orderIndex: 1,
        groupsCount: params.blueprint.divisionsCount,
        participantsPerGroup: params.blueprint.participantsPerGroup ?? undefined,
        roundsCount: openingToursCount,
        pointsForWin: params.tournament.pointsForWin,
        pointsForDraw: params.tournament.pointsForDraw,
        pointsForLoss: params.tournament.pointsForLoss,
        sortRules: params.tournament.sortRules,
        settingsJson: {
          mode: params.blueprint.openingStageMode === "LEAGUE" ? "custom-league" : "custom-groups",
          divisionsCount: params.blueprint.divisionsCount,
          roundsCount: openingToursCount,
          matchesPerOpponent: params.blueprint.roundsCount,
          participantsPerGroup: params.blueprint.participantsPerGroup,
        },
      },
    });

    for (let index = 0; index < params.blueprint.divisionsCount; index += 1) {
      const groupLetter = String.fromCharCode(65 + index);
      await db.tournamentGroup.create({
        data: {
          stageId: leagueStage.id,
          name:
            params.blueprint.divisionsCount === 1
              ? params.blueprint.leagueStageName
              : params.blueprint.openingStageMode === "GROUPS"
                ? `Группа ${groupLetter}`
                : `${params.blueprint.leagueStageName} ${index + 1}`,
          orderIndex: index + 1,
          capacity: params.blueprint.participantsPerGroup ?? undefined,
        },
      });
    }

    stages.push(leagueStage);
  }

  for (let index = 0; index < params.blueprint.playoffs.length; index += 1) {
    const playoff = params.blueprint.playoffs[index];
    const upperEntriesCount = countSelectionEntries(playoff.selections, "upper");
    const lowerEntriesCount = countSelectionEntries(playoff.selections, "lower");
    const directEntriesCount = hasOpeningStage ? 0 : params.tournament.maxParticipants;
    const roundsCount = Math.log2(nextPowerOfTwo(Math.max(upperEntriesCount, lowerEntriesCount, directEntriesCount, 2)));

    const stage = await db.tournamentStage.create({
      data: {
        tournamentId: params.tournamentId,
        name: playoff.name,
        type: StageType.PLAYOFF,
        status: getStageStatus(stages.length > 0, params.tournament.status),
        orderIndex: stages.length + 1,
        roundsCount,
        settingsJson: {
          mode: hasOpeningStage ? "custom-playoff-stage" : "custom-direct-playoff-stage",
          upperEntriesCount,
          lowerEntriesCount,
          directEntriesCount,
        },
      },
    });

    await db.playoffBracket.create({
      data: {
        tournamentId: params.tournamentId,
        stageId: stage.id,
        type: playoff.type,
        size: nextPowerOfTwo(Math.max(upperEntriesCount, lowerEntriesCount, directEntriesCount, 2)),
        legsCount: playoff.type === PlayoffType.DOUBLE ? 1 : playoff.legsCount,
        thirdPlaceMatch: playoff.type === PlayoffType.DOUBLE ? false : playoff.thirdPlaceMatch,
        settingsJson: hasOpeningStage
          ? ({
              mode: "custom",
              selections: playoff.selections,
              upperEntriesCount,
              lowerEntriesCount,
            } satisfies CustomPlayoffSettings)
          : {
              mode: "custom-direct",
            },
      },
    });

    stages.push(stage);
  }

  return stages;
}

async function seedCustomPlayoffBracket(params: {
  bracketId: string;
  groups: Array<{
    id: string;
    orderIndex: number;
    standings: Array<{ participantId: string; rank: number | null; participant: { userId: string } }>;
  }>;
}) {
  const bracket = await db.playoffBracket.findUnique({
    where: { id: params.bracketId },
    include: { matches: { orderBy: [{ bracket: "asc" }, { round: "asc" }, { matchNumber: "asc" }] } },
  });

  if (!bracket) throw new Error("Bracket not found");

  const settings = parseCustomBracketSettings(bracket.settingsJson);
  if (!settings) return bracket;

  const standingMap = new Map(
    params.groups.flatMap((group) =>
      group.standings.map((standing) => [
        createGroupSourceRef(group.id, standing.rank ?? 999),
        {
          participantId: standing.participantId,
          userId: standing.participant.userId,
        },
      ]),
    ),
  );

  const upperRefs = expandSelectionRefs(params.groups, settings.selections, "upper");
  const lowerRefs = expandSelectionRefs(params.groups, settings.selections, "lower");
  const upperSlotMappings = buildCrossGroupPlayoffSlotMappingsFromRefs({
    groups: params.groups,
    sourceRefs: upperRefs,
    bracketSize: bracket.size,
    seed: bracket.id,
  });
  const upperMatches = bracket.matches.filter(
    (match) => match.bracket === "upper" && match.round === 1 && !match.isThirdPlaceMatch && (match.legNumber ?? 1) === 1 && !match.isPenaltyTiebreak,
  );
  const lowerMatches = bracket.matches.filter((match) => match.bracket === "lower" && match.round === 1);

  await Promise.all(
    upperMatches.map((match) =>
      match.seriesKey
        ? db.match.updateMany({
            where: { seriesKey: match.seriesKey },
            data: {
              participant1EntryId: null,
              participant2EntryId: null,
              player1Id: null,
              player2Id: null,
              status: MatchStatus.PENDING,
            },
          })
        : db.match.update({
            where: { id: match.id },
            data: {
              participant1EntryId: null,
              participant2EntryId: null,
              player1Id: null,
              player2Id: null,
              status: MatchStatus.PENDING,
            },
          }),
    ),
  );

  await Promise.all(
    lowerMatches.map((match) =>
      db.match.update({
        where: { id: match.id },
        data: {
          participant1EntryId: null,
          participant2EntryId: null,
          player1Id: null,
          player2Id: null,
          status: MatchStatus.PENDING,
        },
      }),
    ),
  );

  await Promise.all(
    upperMatches.flatMap((match) => {
      const refs = [
        upperSlotMappings.find((mapping) => mapping.matchNumber === match.matchNumber && mapping.slotNumber === 1)?.sourceRef ?? null,
        upperSlotMappings.find((mapping) => mapping.matchNumber === match.matchNumber && mapping.slotNumber === 2)?.sourceRef ?? null,
      ];
      return refs.map((sourceRef, slotIndex) =>
        setBracketSlot({
          bracketId: bracket.id,
          round: 1,
          matchNumber: match.matchNumber,
          slotNumber: slotIndex === 0 ? 1 : 2,
          participantId: sourceRef ? standingMap.get(sourceRef)?.participantId ?? null : null,
          sourceType: sourceRef ? "GROUP_RESULTS" : "MANUAL",
          sourceRef: sourceRef ?? undefined,
        }),
      );
    }),
  );

  await reconcileBracketByes(bracket.id);

  await Promise.all(
    lowerMatches.map(async (match, index) => {
      const firstRef = lowerRefs[index * 2] ?? null;
      const secondRef = lowerRefs[index * 2 + 1] ?? null;
      const firstParticipant = firstRef ? standingMap.get(firstRef) ?? null : null;
      const secondParticipant = secondRef ? standingMap.get(secondRef) ?? null : null;

      await db.match.update({
        where: { id: match.id },
        data: {
          participant1EntryId: firstParticipant?.participantId ?? null,
          participant2EntryId: secondParticipant?.participantId ?? null,
          player1Id: firstParticipant?.userId ?? null,
          player2Id: secondParticipant?.userId ?? null,
          status: firstParticipant && secondParticipant ? MatchStatus.READY : MatchStatus.PENDING,
        },
      });
    }),
  );

  return db.playoffBracket.findUnique({
    where: { id: bracket.id },
    include: { slots: { include: { participant: { include: { user: true } } } }, matches: true },
  });
}

async function ensureCustomPlayoffMatchesGenerated(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      stages: {
        where: { type: StageType.PLAYOFF },
        include: {
          bracket: {
            include: {
              matches: true,
            },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");

  for (const stage of tournament.stages) {
    if (!stage.bracket) continue;
    const customSettings = parseCustomBracketSettings(stage.bracket.settingsJson);
    if (!customSettings) continue;

    if (stage.bracket.matches.length) {
      await ensureThirdPlaceSeriesShape({
        tournamentId,
        stageId: stage.id,
        bracketId: stage.bracket.id,
        rounds: Math.log2(stage.bracket.size),
        thirdPlaceMatch: stage.bracket.thirdPlaceMatch && stage.bracket.type !== PlayoffType.DOUBLE,
        seriesWinsRequired: tournament.matchupFormat === MatchupFormat.BEST_OF ? Math.max(2, Math.min(tournament.bestOfWins, 9)) : null,
      });
      continue;
    }

    await createPlayoffMatches({
      tournamentId,
      stageId: stage.id,
      bracketId: stage.bracket.id,
      entries: [],
      type: stage.bracket.type,
      legsCount: stage.bracket.legsCount,
      thirdPlaceMatch: stage.bracket.thirdPlaceMatch,
      sizeOverride: nextPowerOfTwo(Math.max(customSettings.upperEntriesCount, customSettings.lowerEntriesCount, 2)),
      matchupFormat: tournament.matchupFormat,
      bestOfWins: tournament.bestOfWins,
    });
  }
}

export async function generateTournamentStages(tournamentId: string, options?: { regenerate?: boolean }) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      stages: { include: { groups: true, bracket: true } },
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");

  if (options?.regenerate) {
    await db.tournamentRegistration.updateMany({
      where: { tournamentId },
      data: { groupId: null },
    });
    await db.groupStanding.deleteMany({ where: { group: { stage: { tournamentId } } } });
    await db.bracketSlot.deleteMany({ where: { bracket: { tournamentId } } });
    await db.playoffBracket.deleteMany({ where: { tournamentId } });
    await db.tournamentGroup.deleteMany({ where: { stage: { tournamentId } } });
    await db.tournamentStage.deleteMany({ where: { tournamentId } });
    // After stages/groups deleted, their matches are orphaned (stageId=null). Remove them.
    await db.match.deleteMany({ where: { tournamentId, stageId: null } });
  } else if (tournament.stages.length) {
    return tournament.stages;
  }

  const stages: TournamentStage[] = [];

  if (tournament.format === TournamentFormat.CUSTOM) {
    const blueprint = normalizeFormatBlueprint(tournament.formatBlueprintJson);
    return createCustomFormatStages({
      tournamentId,
      tournament: {
        status: tournament.status,
        maxParticipants: tournament.maxParticipants,
        pointsForWin: tournament.pointsForWin,
        pointsForDraw: tournament.pointsForDraw,
        pointsForLoss: tournament.pointsForLoss,
        sortRules: tournament.sortRules,
      },
      blueprint,
    });
  }

  if (tournament.format === TournamentFormat.LEAGUE || tournament.format === TournamentFormat.ROUND_ROBIN) {
    stages.push(
      await db.tournamentStage.create({
        data: {
          tournamentId,
          name: "League Stage",
          type: StageType.LEAGUE,
          status: TournamentStatus.IN_PROGRESS === tournament.status ? StageStatus.ACTIVE : StageStatus.PENDING,
          orderIndex: 1,
          roundsCount: tournament.roundsInLeague,
          pointsForWin: tournament.pointsForWin,
          pointsForDraw: tournament.pointsForDraw,
          pointsForLoss: tournament.pointsForLoss,
          sortRules: tournament.sortRules,
        },
      }),
    );
  }

  if (tournament.format === TournamentFormat.GROUPS || tournament.format === TournamentFormat.GROUPS_PLAYOFF) {
    const groupStage = await db.tournamentStage.create({
      data: {
        tournamentId,
        name: "Group Stage",
        type: StageType.GROUP_STAGE,
        status: TournamentStatus.IN_PROGRESS === tournament.status ? StageStatus.ACTIVE : StageStatus.PENDING,
        orderIndex: 1,
        groupsCount: tournament.groupsCount ?? Math.max(1, Math.floor(Math.sqrt(Math.max(tournament.participants.length, 1)))),
        participantsPerGroup: tournament.participantsPerGroup ?? undefined,
        advancingPerGroup: tournament.playoffTeamsPerGroup ?? 2,
        pointsForWin: tournament.pointsForWin,
        pointsForDraw: tournament.pointsForDraw,
        pointsForLoss: tournament.pointsForLoss,
        sortRules: tournament.sortRules,
      },
    });

    const groupsCount = groupStage.groupsCount ?? 1;
    for (let index = 0; index < groupsCount; index += 1) {
      await db.tournamentGroup.create({
        data: {
          stageId: groupStage.id,
          name: `Group ${String.fromCharCode(65 + index)}`,
          orderIndex: index + 1,
          capacity: tournament.participantsPerGroup ?? undefined,
        },
      });
    }

    stages.push(groupStage);
  }

  if (
    tournament.format === TournamentFormat.SINGLE_ELIMINATION ||
    tournament.format === TournamentFormat.DOUBLE_ELIMINATION ||
    tournament.format === TournamentFormat.GROUPS_PLAYOFF
  ) {
    const stageOrder = stages.length + 1;
    const playoffSize = getDefaultPlayoffSize(tournament);
    const playoffStage = await db.tournamentStage.create({
      data: {
        tournamentId,
        name: "Playoff",
        type: StageType.PLAYOFF,
        status: stages.length ? StageStatus.PENDING : TournamentStatus.IN_PROGRESS === tournament.status ? StageStatus.ACTIVE : StageStatus.PENDING,
        orderIndex: stageOrder,
        roundsCount: Math.log2(playoffSize),
      },
    });

    await db.playoffBracket.create({
      data: {
        type:
          tournament.playoffType ??
          (tournament.format === TournamentFormat.DOUBLE_ELIMINATION ? PlayoffType.DOUBLE : PlayoffType.SINGLE),
        tournamentId,
        stageId: playoffStage.id,
        size: playoffSize,
        legsCount:
          (tournament.playoffType ??
            (tournament.format === TournamentFormat.DOUBLE_ELIMINATION ? PlayoffType.DOUBLE : PlayoffType.SINGLE)) === PlayoffType.DOUBLE
            ? 1
            : tournament.playoffLegs,
        thirdPlaceMatch:
          (tournament.playoffType ??
            (tournament.format === TournamentFormat.DOUBLE_ELIMINATION ? PlayoffType.DOUBLE : PlayoffType.SINGLE)) === PlayoffType.DOUBLE
            ? false
            : tournament.playoffThirdPlace,
      },
    });

    stages.push(playoffStage);
  }

  return stages;
}

export async function assignParticipantsToGroups(
  tournamentId: string,
  input: { mode: "auto" | "manual"; assignments?: { registrationId: string; groupId: string }[] },
) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
        include: {
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
          },
        },
      },
      stages: {
        where: { type: StageType.GROUP_STAGE },
        include: { groups: { orderBy: { orderIndex: "asc" } } },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");
  const groupStage = tournament.stages[0];
  if (!groupStage) throw new Error("Group stage not found");

  const groups = groupStage.groups;
  if (!groups.length) throw new Error("No groups configured");

  const fallbackGroupCapacity = groupStage.participantsPerGroup ?? Math.max(1, Math.ceil(tournament.participants.length / groups.length));
  const seedGroups = groups.map((group) => ({
    id: group.id,
    capacity: group.capacity ?? fallbackGroupCapacity,
  }));
  const capacityLimit = seedGroups.reduce((total, group) => total + group.capacity, 0);
  if (tournament.participants.length > capacityLimit) {
    throw new Error(`В группах есть место только для ${capacityLimit} участников.`);
  }

  if (input.mode === "manual") {
    const assignments = input.assignments ?? [];
    await Promise.all(
      assignments.map((item) =>
        db.tournamentRegistration.update({
          where: { id: item.registrationId },
          data: { groupId: item.groupId },
        }),
      ),
    );
  } else {
    const { ordered, shouldPersistSeeds } = await orderTournamentParticipantsForSeeding(
      tournament.participants,
      tournament.seedingMethod,
      tournament.seasonId,
    );
    const assignments = assignParticipantsByGroupCapacity(ordered, seedGroups, {
      preserveExisting: !shouldPersistSeeds,
    });
    await Promise.all(
      assignments.map((assignment) =>
        db.tournamentRegistration.update({
          where: { id: assignment.participant.id },
          data: {
            groupId: assignment.groupId,
            ...(shouldPersistSeeds ? { seed: assignment.seed } : {}),
          },
        }),
      ),
    );
  }

  const registrations = await db.tournamentRegistration.findMany({
    where: { tournamentId, groupId: { not: null } },
  });

  for (const group of groups) {
    const members = registrations.filter((item) => item.groupId === group.id);
    await ensureGroupStandings(
      group.id,
      members.map((item) => item.id),
    );
  }

  // Group assignment changes both the structure (groups/standings) and each
  // participant's groupId.
  invalidateTournamentStructure(tournamentId);
  invalidateTournamentParticipants(tournamentId);

  return db.tournamentGroup.findMany({
    where: { stageId: groupStage.id },
    include: {
      members: { include: { user: true } },
      standings: { include: { participant: { include: { user: true } } } },
    },
    orderBy: { orderIndex: "asc" },
  });
}

export async function syncTournamentPreviewGroups(tournamentId: string) {
  const existingStages = await db.tournamentStage.findMany({
    where: { tournamentId },
    select: { id: true },
    take: 1,
  });

  if (!existingStages.length) {
    await generateTournamentStages(tournamentId);
  }

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      stages: {
        where: { type: StageType.GROUP_STAGE },
        include: {
          groups: {
            include: {
              members: { where: { status: ParticipantStatus.CONFIRMED } },
              standings: true,
              _count: { select: { matches: true } },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");
  const groupStage = tournament.stages[0];
  if (!groupStage) return null;

  const blueprint = tournament.format === TournamentFormat.CUSTOM ? normalizeFormatBlueprint(tournament.formatBlueprintJson) : null;
  const expectedGroupsCount =
    blueprint && blueprint.openingStageMode !== "NONE"
      ? blueprint.divisionsCount
      : groupStage.groupsCount ?? 1;
  const expectedParticipantsPerGroup =
    blueprint && blueprint.openingStageMode !== "NONE"
      ? blueprint.participantsPerGroup ?? Math.max(2, Math.ceil(tournament.maxParticipants / blueprint.divisionsCount))
      : groupStage.participantsPerGroup;
  const expectedToursCount =
    blueprint?.openingRoundsCount ?? getRoundRobinToursCount(expectedParticipantsPerGroup ?? Math.max(tournament.participants.length, 1));
  const extraEmptyGroups = groupStage.groups.filter(
    (group) => group.orderIndex > expectedGroupsCount && group.members.length === 0 && group._count.matches === 0,
  );

  if (groupStage.groupsCount !== expectedGroupsCount || groupStage.participantsPerGroup !== expectedParticipantsPerGroup) {
    await db.tournamentStage.update({
      where: { id: groupStage.id },
      data: {
        groupsCount: expectedGroupsCount,
        participantsPerGroup: expectedParticipantsPerGroup,
        ...(blueprint
          ? {
              roundsCount: expectedToursCount,
              settingsJson: {
                mode: blueprint.openingStageMode === "LEAGUE" ? "custom-league" : "custom-groups",
                divisionsCount: expectedGroupsCount,
                roundsCount: expectedToursCount,
                matchesPerOpponent: blueprint.roundsCount,
                participantsPerGroup: blueprint.participantsPerGroup,
              },
            }
          : {}),
      },
    });
  }

  if (extraEmptyGroups.length) {
    const extraGroupIds = extraEmptyGroups.map((group) => group.id);
    await db.groupStanding.deleteMany({ where: { groupId: { in: extraGroupIds } } });
    await db.tournamentGroup.deleteMany({ where: { id: { in: extraGroupIds } } });
    return assignParticipantsToGroups(tournamentId, { mode: "auto" });
  }

  let createdMissingGroups = false;
  if (groupStage.groups.length < expectedGroupsCount) {
    for (let index = groupStage.groups.length; index < expectedGroupsCount; index += 1) {
      await db.tournamentGroup.create({
        data: {
          stageId: groupStage.id,
          name: `Группа ${String.fromCharCode(65 + index)}`,
          orderIndex: index + 1,
          capacity: groupStage.participantsPerGroup ?? undefined,
        },
      });
    }
    createdMissingGroups = true;
  }

  const groupIds = new Set(groupStage.groups.map((group) => group.id));
  const hasUnassignedMembers = tournament.participants.some((participant) => !participant.groupId || !groupIds.has(participant.groupId));
  const hasOverflowingGroups = groupStage.groups.some((group) => {
    const capacity = group.capacity ?? groupStage.participantsPerGroup ?? 0;
    return capacity > 0 && group.members.length > capacity;
  });

  if (createdMissingGroups || hasUnassignedMembers || hasOverflowingGroups) {
    return assignParticipantsToGroups(tournamentId, { mode: "auto" });
  }

  await Promise.all(groupStage.groups.map((group) => ensureGroupStandings(group.id, group.members.map((member) => member.id))));

  invalidateTournamentStructure(tournamentId);

  return db.tournamentGroup.findMany({
    where: { stageId: groupStage.id },
    include: {
      members: { include: { user: true }, orderBy: [{ seed: "asc" }, { createdAt: "asc" }] },
      standings: { include: { participant: { include: { user: true } } } },
    },
    orderBy: { orderIndex: "asc" },
  });
}

export async function generateTournamentMatches(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        include: { user: true },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      stages: {
        include: {
          groups: {
            include: { members: true },
            orderBy: { orderIndex: "asc" },
          },
          bracket: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");

  for (const stage of tournament.stages) {
    if (stage.type === StageType.LEAGUE) {
      const existingCount = await db.match.count({ where: { stageId: stage.id } });
      if (existingCount > 0) continue;
      await createRoundRobinMatchesForEntries({
        tournamentId,
        stageId: stage.id,
        entries: tournament.participants.map((entry) => ({ id: entry.id, userId: entry.userId })),
        roundsCount: stage.roundsCount,
        matchesPerOpponent: getCustomStageMatchesPerOpponent(stage, tournament.formatBlueprintJson),
        roundsMode: isCustomTourCountStage(stage) ? "series" : "cycles",
        matchupFormat: tournament.matchupFormat,
        bestOfWins: tournament.bestOfWins,
      });
    }

    if (stage.type === StageType.GROUP_STAGE) {
      for (const group of stage.groups) {
        const members = group.members.map((entry) => ({ id: entry.id, userId: entry.userId }));
        if (members.length < 2) continue;
        const existingCount = await db.match.count({ where: { groupId: group.id } });
        if (existingCount > 0) continue;
        await createRoundRobinMatchesForEntries({
          tournamentId,
          stageId: stage.id,
          groupId: group.id,
          entries: members,
          roundsCount: stage.roundsCount,
          matchesPerOpponent: getCustomStageMatchesPerOpponent(stage, tournament.formatBlueprintJson),
          roundsMode: isCustomTourCountStage(stage) ? "series" : "cycles",
          matchupFormat: tournament.matchupFormat,
          bestOfWins: tournament.bestOfWins,
        });
      }
    }

    if (stage.type === StageType.PLAYOFF && stage.bracket) {
      const customSettings = tournament.format === TournamentFormat.CUSTOM ? parseCustomBracketSettings(stage.bracket.settingsJson) : null;

      if (customSettings) {
        continue;
      } else {
        const existingCount = await db.match.count({ where: { bracketId: stage.bracket.id } });
        if (existingCount > 0) {
          await ensureThirdPlaceSeriesShape({
            tournamentId,
            stageId: stage.id,
            bracketId: stage.bracket.id,
            rounds: Math.log2(stage.bracket.size),
            thirdPlaceMatch: stage.bracket.thirdPlaceMatch && stage.bracket.type !== PlayoffType.DOUBLE,
            seriesWinsRequired: tournament.matchupFormat === MatchupFormat.BEST_OF ? Math.max(2, Math.min(tournament.bestOfWins, 9)) : null,
          });
          continue;
        }
        const playoffEntries =
          tournament.format === TournamentFormat.GROUPS_PLAYOFF
            ? []
            : tournament.participants.map((entry) => ({ id: entry.id, userId: entry.userId, seed: entry.seed }));
        await createPlayoffMatches({
          tournamentId,
          stageId: stage.id,
          bracketId: stage.bracket.id,
          entries: playoffEntries,
          type: stage.bracket.type,
          legsCount: stage.bracket.legsCount,
          thirdPlaceMatch: stage.bracket.thirdPlaceMatch,
          sizeOverride: stage.bracket.size,
          matchupFormat: tournament.matchupFormat,
          bestOfWins: tournament.bestOfWins,
        });
      }
    }
  }

  await prepareCaptainAssignedTeamMatchSlots(tournamentId);

  if (tournament.status === TournamentStatus.REGISTRATION_CLOSED || tournament.status === TournamentStatus.AWAITING_START) {
    await applyTournamentAbsenceRatingPenalty(tournamentId);

    await db.tournament.update({
      where: { id: tournamentId },
      data: {
        status: TournamentStatus.IN_PROGRESS,
        registrationClosedAt: tournament.registrationClosedAt ?? new Date(),
      },
    });
  }

  return db.match.findMany({ where: { tournamentId } });
}

export async function generateTournamentSchedule(
  tournamentId: string,
  options?: { overwrite?: boolean; slotMinutes?: number; breakBetweenRoundsMinutes?: number },
) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      matches: {
        include: {
          schedules: true,
          group: true,
          stage: true,
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");
  if (!tournament.matches.length) throw new Error("No matches to schedule");

  const overwrite = options?.overwrite ?? false;
  const slotMinutes = options?.slotMinutes ?? 60;
  const breakBetweenRoundsMinutes = options?.breakBetweenRoundsMinutes ?? 30;

  let cursor = new Date(tournament.startsAt);
  let currentRound = tournament.matches[0]?.round ?? 1;

  const createdSchedules = [];

  for (const match of tournament.matches) {
    if (!overwrite && (match.scheduledAt || match.schedules.length)) {
      const existingStartsAt = match.scheduledAt ?? match.schedules[0]?.startsAt;
      if (existingStartsAt) {
        cursor = new Date(existingStartsAt);
      }
      continue;
    }

    if (match.round !== currentRound) {
      currentRound = match.round;
      cursor = new Date(cursor.getTime() + breakBetweenRoundsMinutes * 60_000);
    }

    const startsAt = new Date(cursor);
    const endsAt = new Date(startsAt.getTime() + slotMinutes * 60_000);
    const slotLabel = match.group?.name
      ? `${match.group.name} • Тур ${match.round}`
      : match.stage?.name
        ? `${match.stage.name} • Раунд ${match.round}`
        : `Раунд ${match.round} • Матч ${match.matchNumber}`;

    const existingSchedule = match.schedules[0];
    const schedule = existingSchedule
      ? await db.matchSchedule.update({
          where: { id: existingSchedule.id },
          data: {
            startsAt,
            endsAt,
            slotLabel,
            timezone: "Europe/Moscow",
          },
        })
      : await db.matchSchedule.create({
          data: {
            matchId: match.id,
            startsAt,
            endsAt,
            slotLabel,
            timezone: "Europe/Moscow",
          },
        });

    await db.match.update({
      where: { id: match.id },
      data: {
        scheduledAt: startsAt,
        status: match.status === MatchStatus.PENDING || match.status === MatchStatus.READY ? MatchStatus.SCHEDULED : match.status,
      },
    });

    createdSchedules.push(schedule);
    cursor = new Date(endsAt.getTime());
  }

  return createdSchedules;
}

export async function assignRandomClubsToTournament(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");
  if (tournament.clubSelectionMode !== ClubSelectionMode.ADMIN_RANDOM) {
    throw new Error("This tournament uses player club selection.");
  }

  if (tournament.status === TournamentStatus.REGISTRATION_OPEN && tournament.registrationEndsAt > new Date()) {
    throw new Error("Registration must be closed before random club assignment.");
  }

  const clubs = await getAvailableClubs();
  if (!clubs.length) throw new Error("No club badges found in public/club-badges.");

  const usedClubs = tournament.participants.map((item) => item.clubSlug).filter(Boolean) as string[];
  const freeClubs = shuffleParticipants(clubs.filter((club) => !usedClubs.includes(club.slug)));
  const unassigned = tournament.participants.filter((item) => !item.clubSlug);

  if (freeClubs.length < unassigned.length) {
    throw new Error("Not enough clubs to assign all participants.");
  }

  await Promise.all(
    unassigned.map((entry, index) =>
      db.tournamentRegistration.update({
        where: { id: entry.id },
        data: {
          clubSlug: freeClubs[index].slug,
          clubName: freeClubs[index].name,
          clubBadgePath: freeClubs[index].imagePath,
        },
      }),
    ),
  );

  return db.tournamentRegistration.findMany({
    where: { tournamentId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

function getReplacementRegistrationId(notes?: string | null) {
  return notes?.match(/replacementRegistrationId:([A-Za-z0-9]+)/)?.[1] ?? null;
}

function resolveReplacementRegistrationId(entryId: string, replacements: Map<string, string>) {
  let current = entryId;
  const seen = new Set<string>();

  while (replacements.has(current) && !seen.has(current)) {
    seen.add(current);
    current = replacements.get(current)!;
  }

  return current;
}

export async function recalculateGroupStandings(tournamentId: string) {
  const groups = await db.tournamentGroup.findMany({
    where: { stage: { tournamentId } },
    include: {
      members: {
        where: { status: { not: ParticipantStatus.REJECTED } },
      },
      matches: true,
      standings: true,
      stage: true,
    },
    orderBy: { orderIndex: "asc" },
  });

  for (const group of groups) {
    const groupMemberIds = new Set(group.members.map((member) => member.id));
    const replacementByEntryId = new Map(
      group.members
        .filter((member) => member.status === ParticipantStatus.REMOVED)
        .map((member) => [member.id, getReplacementRegistrationId(member.notes)])
        .filter((item): item is [string, string] => Boolean(item[1] && groupMemberIds.has(item[1]))),
    );
    const visibleMemberIds = new Set(group.members.filter((member) => member.status === ParticipantStatus.CONFIRMED).map((member) => member.id));
    const staleStandingIds = group.standings
      .filter((standing) => !visibleMemberIds.has(standing.participantId))
      .map((standing) => standing.id);

    if (staleStandingIds.length) {
      await db.groupStanding.deleteMany({
        where: {
          id: { in: staleStandingIds },
        },
      });
    }

    const base = new Map(
      group.members
        .filter((member) => visibleMemberIds.has(member.id))
        .map((member) => [
          member.id,
          {
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
          },
        ]),
    );

    const completedMatches = group.matches
      .filter((item) => item.status === MatchStatus.CONFIRMED || item.status === MatchStatus.FINISHED)
      .sort((a, b) => (a.round === b.round ? a.matchNumber - b.matchNumber : a.round - b.round));
    const countedSeriesKeys = new Set<string>();

    for (const match of completedMatches) {
      if (!match.participant1EntryId || !match.participant2EntryId) continue;
      if (match.player1Score == null || match.player2Score == null) continue;

      const resolvedOneId = resolveReplacementRegistrationId(match.participant1EntryId, replacementByEntryId);
      const resolvedTwoId = resolveReplacementRegistrationId(match.participant2EntryId, replacementByEntryId);
      const one = base.get(resolvedOneId);
      const two = base.get(resolvedTwoId);
      if (!one || !two) continue;

      if (match.seriesKey && match.seriesWinsRequired && match.seriesWinsRequired > 1) {
        if (countedSeriesKeys.has(match.seriesKey)) continue;
        const winsRequired = match.seriesWinsRequired;

        const seriesMatches = completedMatches.filter(
          (item) =>
            item.seriesKey === match.seriesKey &&
            !item.isPenaltyTiebreak &&
            item.participant1EntryId &&
            item.participant2EntryId &&
            item.player1Score != null &&
            item.player2Score != null,
        );
        const seriesRows = new Map<string, { wins: number; goalsFor: number; goalsAgainst: number }>();
        const ensureSeriesRow = (participantId: string) => {
          const existing = seriesRows.get(participantId);
          if (existing) return existing;
          const created = { wins: 0, goalsFor: 0, goalsAgainst: 0 };
          seriesRows.set(participantId, created);
          return created;
        };

        for (const seriesMatch of seriesMatches) {
          const seriesOneId = resolveReplacementRegistrationId(seriesMatch.participant1EntryId!, replacementByEntryId);
          const seriesTwoId = resolveReplacementRegistrationId(seriesMatch.participant2EntryId!, replacementByEntryId);
          const seriesOne = ensureSeriesRow(seriesOneId);
          const seriesTwo = ensureSeriesRow(seriesTwoId);
          const scoreOne = seriesMatch.player1Score ?? 0;
          const scoreTwo = seriesMatch.player2Score ?? 0;
          const winnerEntryId =
            seriesMatch.winnerEntryId ??
            (seriesMatch.winnerId === seriesMatch.player1Id
              ? seriesMatch.participant1EntryId
              : seriesMatch.winnerId === seriesMatch.player2Id
                ? seriesMatch.participant2EntryId
                : null);

          seriesOne.goalsFor += scoreOne;
          seriesOne.goalsAgainst += scoreTwo;
          seriesTwo.goalsFor += scoreTwo;
          seriesTwo.goalsAgainst += scoreOne;

          if (scoreOne > scoreTwo || (scoreOne === scoreTwo && winnerEntryId === seriesMatch.participant1EntryId)) {
            seriesOne.wins += 1;
          } else if (scoreTwo > scoreOne || (scoreOne === scoreTwo && winnerEntryId === seriesMatch.participant2EntryId)) {
            seriesTwo.wins += 1;
          }
        }

        const winnerId = Array.from(seriesRows.entries()).find(([, row]) => row.wins >= winsRequired)?.[0];
        if (!winnerId) continue;

        for (const [participantId, row] of Array.from(seriesRows.entries())) {
          const target = base.get(participantId);
          if (!target) continue;
          target.goalsFor += row.goalsFor;
          target.goalsAgainst += row.goalsAgainst;
        }

        one.played += 1;
        two.played += 1;
        if (winnerId === resolvedOneId) {
          one.wins += 1;
          two.losses += 1;
        } else if (winnerId === resolvedTwoId) {
          two.wins += 1;
          one.losses += 1;
        }
        countedSeriesKeys.add(match.seriesKey);
        continue;
      }

      one.played += 1;
      two.played += 1;
      one.goalsFor += match.player1Score;
      one.goalsAgainst += match.player2Score;
      two.goalsFor += match.player2Score;
      two.goalsAgainst += match.player1Score;

      if (match.player1Score > match.player2Score) {
        one.wins += 1;
        two.losses += 1;
      } else if (match.player1Score < match.player2Score) {
        two.wins += 1;
        one.losses += 1;
      } else {
        one.draws += 1;
        two.draws += 1;
      }
    }

    const stage = group.stage;
    const pointsForWin = stage?.pointsForWin ?? 3;
    const pointsForDraw = stage?.pointsForDraw ?? 1;
    const pointsForLoss = stage?.pointsForLoss ?? 0;

    const ordered = Array.from(base.entries()).map(([participantId, values]) => ({
      participantId,
      ...values,
      goalDifference: values.goalsFor - values.goalsAgainst,
      points: values.wins * pointsForWin + values.draws * pointsForDraw + values.losses * pointsForLoss,
    }));

    ordered.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return b.wins - a.wins;
    });

    await Promise.all(
      ordered.map((row, index) =>
        db.groupStanding.upsert({
          where: { groupId_participantId: { groupId: group.id, participantId: row.participantId } },
          update: {
            played: row.played,
            wins: row.wins,
            draws: row.draws,
            losses: row.losses,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference,
            points: row.points,
            rank: index + 1,
          },
          create: {
            groupId: group.id,
            participantId: row.participantId,
            played: row.played,
            wins: row.wins,
            draws: row.draws,
            losses: row.losses,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference,
            points: row.points,
            rank: index + 1,
          },
        }),
      ),
    );
  }

  invalidateTournamentStructure(tournamentId);

  return db.tournamentGroup.findMany({
    where: { stage: { tournamentId } },
    include: {
      standings: {
        where: {
          participant: { status: ParticipantStatus.CONFIRMED },
        },
        include: { participant: { include: { user: true } } },
        orderBy: { rank: "asc" },
      },
    },
    orderBy: { orderIndex: "asc" },
  });
}

export async function generatePlayoffFromGroups(tournamentId: string) {
  await recalculateGroupStandings(tournamentId);

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      stages: {
        include: {
          groups: {
            include: {
              standings: {
                include: { participant: true },
                orderBy: { rank: "asc" },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
          bracket: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");

  if (tournament.format === TournamentFormat.CUSTOM) {
    const leagueStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
    if (!leagueStage) throw new Error("League stage not found");

    const playoffStages = tournament.stages.filter((stage) => stage.type === StageType.PLAYOFF && stage.bracket);
    if (!playoffStages.length) throw new Error("Playoff stages are not configured");

    await ensureCustomPlayoffMatchesGenerated(tournamentId);

    const seeded = await Promise.all(
      playoffStages.map((stage) =>
        seedCustomPlayoffBracket({
          bracketId: stage.bracket!.id,
          groups: leagueStage.groups.map((group) => ({
            id: group.id,
            orderIndex: group.orderIndex,
            standings: group.standings.map((standing) => ({
              participantId: standing.participantId,
              rank: standing.rank,
              participant: { userId: standing.participant.userId },
            })),
          })),
        }),
      ),
    );

    await notifyPlayoffQualified(tournamentId);

    return seeded[0];
  }

  const groupStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
  const playoffStage = tournament.stages.find((stage) => stage.type === StageType.PLAYOFF);
  if (!groupStage || !playoffStage?.bracket) throw new Error("Stages for groups/playoff are not configured");

  const bracketSize = Math.max(getDefaultPlayoffSize(tournament), playoffStage.bracket.size);
  await ensureGroupsPlayoffBracketShape({
    tournamentId,
    stageId: playoffStage.id,
    bracketId: playoffStage.bracket.id,
    type: playoffStage.bracket.type,
    legsCount: playoffStage.bracket.legsCount,
    thirdPlaceMatch: playoffStage.bracket.thirdPlaceMatch,
    bracketSize,
    matchupFormat: tournament.matchupFormat,
    bestOfWins: tournament.bestOfWins,
  });

  const roundOneMatches = await db.match.findMany({
    where: {
      bracketId: playoffStage.bracket.id,
      round: 1,
      bracket: "upper",
      isThirdPlaceMatch: false,
      isPenaltyTiebreak: false,
      legNumber: 1,
    },
    orderBy: { matchNumber: "asc" },
  });

  const existingRoundOneMappings = await db.bracketSlot.findMany({
    where: {
      bracketId: playoffStage.bracket.id,
      round: 1,
      sourceType: "GROUP_RESULTS",
      sourceRef: { not: null },
    },
    orderBy: [{ matchNumber: "asc" }, { slotNumber: "asc" }],
  });

  const advancingPerGroup = resolveGroupsAdvancingPerGroup({
    groupStageValue: groupStage.advancingPerGroup,
    tournamentValue: tournament.playoffTeamsPerGroup,
    bracketSize,
    groupsCount: groupStage.groups.length,
  });
  const shouldKeepExistingMappings = isValidCrossGroupPlayoffMapping(existingRoundOneMappings, advancingPerGroup);
  const mappedSlots = shouldKeepExistingMappings
    ? existingRoundOneMappings.map((slot) => ({
        round: 1 as const,
        matchNumber: slot.matchNumber,
        slotNumber: slot.slotNumber as 1 | 2,
        sourceRef: slot.sourceRef!,
      }))
    : buildCrossGroupPlayoffSlotMappings({
        groups: groupStage.groups,
        advancingPerGroup,
        bracketSize,
        seed: tournament.id,
      });

  if (!shouldKeepExistingMappings) {
    const terminalPlayoffMatches = await db.match.count({
      where: {
        bracketId: playoffStage.bracket.id,
        status: { in: Array.from(TERMINAL_MATCH_STATUSES) },
      },
    });

    if (terminalPlayoffMatches > 0) {
      throw new Error("Нельзя пересобрать посев плей-офф: в сетке уже есть завершенные матчи.");
    }
  }

  await db.match.updateMany({
    where: { bracketId: playoffStage.bracket.id, round: 1, status: { notIn: Array.from(TERMINAL_MATCH_STATUSES) } },
    data: {
      participant1EntryId: null,
      participant2EntryId: null,
      player1Id: null,
      player2Id: null,
      winnerId: null,
      winnerEntryId: null,
      player1Score: null,
      player2Score: null,
      player1PenaltyScore: null,
      player2PenaltyScore: null,
      finishedAt: null,
      notes: null,
      status: MatchStatus.PENDING,
    },
  });

  const standingMap = new Map(
    groupStage.groups.flatMap((group) =>
      group.standings.map((standing) => [createGroupSourceRef(group.id, standing.rank ?? 999), standing.participantId]),
    ),
  );

  await Promise.all(
    roundOneMatches.flatMap((match) =>
      [1, 2].map((slotNumber) => {
        const mapping = mappedSlots.find((item) => item.matchNumber === match.matchNumber && item.slotNumber === slotNumber);
        return setBracketSlot({
          bracketId: playoffStage.bracket!.id,
          round: 1,
          matchNumber: match.matchNumber,
          slotNumber,
          participantId: mapping?.sourceRef ? standingMap.get(mapping.sourceRef) ?? null : null,
          sourceType: mapping?.sourceRef ? "GROUP_RESULTS" : "MANUAL",
          sourceRef: mapping?.sourceRef ?? undefined,
        });
      }),
    ),
  );

  await reconcileBracketByes(playoffStage.bracket.id);

  await notifyPlayoffQualified(tournamentId);

  return db.playoffBracket.findUnique({
    where: { id: playoffStage.bracket.id },
    include: { slots: { include: { participant: { include: { user: true } } } } },
  });
}

export async function savePlayoffMapping(input: {
  tournamentId: string;
  bracketId: string;
  mappings: Array<{
    round: number;
    matchNumber: number;
    slotNumber: number;
    sourceRef?: string | null;
  }>;
}) {
  const tournament = await db.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      stages: {
        where: { type: StageType.GROUP_STAGE },
        include: {
          groups: {
            include: {
              standings: {
                orderBy: { rank: "asc" },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");
  const groupStage = tournament.stages[0];
  if (!groupStage) throw new Error("Group stage not found");

  const standingMap = new Map(
    groupStage.groups.flatMap((group) =>
      group.standings.map((standing) => [createGroupSourceRef(group.id, standing.rank ?? 999), standing.participantId]),
    ),
  );

  const saved = await Promise.all(
    input.mappings.map((mapping) =>
      setBracketSlot({
        bracketId: input.bracketId,
        round: mapping.round,
        matchNumber: mapping.matchNumber,
        slotNumber: mapping.slotNumber,
        participantId: mapping.sourceRef ? standingMap.get(mapping.sourceRef) ?? null : null,
        sourceType: mapping.sourceRef ? "GROUP_RESULTS" : "MANUAL",
        sourceRef: mapping.sourceRef ?? undefined,
      }),
    ),
  );

  return saved;
}

export async function setBracketSlot(input: {
  bracketId: string;
  round: number;
  matchNumber: number;
  slotNumber: number;
  participantId?: string | null;
  sourceType?: string;
  sourceRef?: string;
}) {
  const slot = await db.bracketSlot.upsert({
    where: {
      bracketId_round_matchNumber_slotNumber: {
        bracketId: input.bracketId,
        round: input.round,
        matchNumber: input.matchNumber,
        slotNumber: input.slotNumber,
      },
    },
    update: {
      participantId: input.participantId ?? null,
      sourceType: input.sourceType || "MANUAL",
      sourceRef: input.sourceRef || null,
    },
    create: {
      bracketId: input.bracketId,
      round: input.round,
      matchNumber: input.matchNumber,
      slotNumber: input.slotNumber,
      participantId: input.participantId ?? null,
      sourceType: input.sourceType || "MANUAL",
      sourceRef: input.sourceRef || null,
    },
    include: { participant: true },
  });

  const bracket = await db.playoffBracket.findUnique({
    where: { id: input.bracketId },
    include: { stage: true },
  });

  if (!bracket) throw new Error("Bracket not found");

  const match = await db.match.findFirst({
    where: {
      bracketId: input.bracketId,
      round: input.round,
      matchNumber: input.matchNumber,
      bracket: "upper",
    },
    select: {
      id: true,
      seriesKey: true,
    },
  });

  if (match) {
    const targetMatches = match.seriesKey
      ? await db.match.findMany({
          where: {
            seriesKey: match.seriesKey,
            isPenaltyTiebreak: false,
          },
          select: { id: true },
        })
      : await db.match.findMany({
          where: { id: match.id },
          select: { id: true },
        });

    await Promise.all(
      targetMatches.map(async (targetMatch) => {
        const updated = await db.match.update({
          where: { id: targetMatch.id },
          data:
            input.slotNumber === 1
              ? {
                  participant1EntryId: slot.participantId ?? null,
                  player1Id: slot.participant?.userId ?? null,
                }
              : {
                  participant2EntryId: slot.participantId ?? null,
                  player2Id: slot.participant?.userId ?? null,
                },
          select: {
            id: true,
            participant1EntryId: true,
            participant2EntryId: true,
            status: true,
          },
        });

        if (updated.participant1EntryId && updated.participant2EntryId && updated.status === MatchStatus.PENDING) {
          await db.match.update({
            where: { id: updated.id },
            data: { status: MatchStatus.READY },
          });
          await notifyMatchReady(updated.id);
        }
      }),
    );
  }

  await reconcileBracketByes(input.bracketId);

  return slot;
}

export async function closeTournamentRegistration(tournamentId: string) {
  await removeIncompleteRosterRegistrations(tournamentId);

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      matches: true,
      stages: true,
    },
  });

  if (!tournament) throw new Error("Tournament not found");
  const confirmedParticipants = tournament.participants.length;
  if (confirmedParticipants < 2) {
    throw new Error("Для закрытия регистрации нужно минимум 2 участника.");
  }

  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.AWAITING_START,
      registrationClosedAt: new Date(),
    },
  });

  await applyTournamentAbsenceRatingPenalty(tournamentId);

  if (!tournamentNotificationsEnabled(tournament)) {
    return db.tournament.findUnique({ where: { id: tournamentId } });
  }

  await Promise.all(
    tournament.participants.map((player) =>
      createNotification({
        userId: player.user.id,
        title: "Регистрация закрыта",
        body: `${tournament.title}: регистрация закрыта. Ожидается запуск турнира администратором.`,
        type: NotificationType.TOURNAMENT,
        link: `/tournaments/${tournament.id}`,
      }),
    ),
  );

  await notifyFirstRoundMatchesReady(tournamentId);

  return db.tournament.findUnique({ where: { id: tournamentId } });
}

export async function startTournament(tournamentId: string) {
  await removeIncompleteRosterRegistrations(tournamentId);

  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        include: {
          user: true,
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
          },
        },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      matches: true,
      stages: true,
    },
  });

  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== TournamentStatus.REGISTRATION_CLOSED && tournament.status !== TournamentStatus.AWAITING_START) {
    throw new Error("Турнир можно запустить только после закрытия регистрации.");
  }

  const confirmedParticipants = tournament.participants.length;
  if (confirmedParticipants < 2) {
    throw new Error("Для старта турнира нужно минимум 2 участника.");
  }

  const missingClub = tournament.participants.find(
    (participant) => !participant.clubSlug || !participant.clubName || !participant.clubBadgePath,
  );
  if (missingClub) {
    throw new Error("Перед стартом турнира всем участникам нужно назначить клубы.");
  }

  if (!tournament.stages.length) {
    await generateTournamentStages(tournamentId);
  }

  const requiresGroupAssignments =
    (tournament.format === TournamentFormat.CUSTOM && !isCustomDirectPlayoff(tournament.format, tournament.formatBlueprintJson)) ||
    tournament.format === TournamentFormat.GROUPS ||
    tournament.format === TournamentFormat.GROUPS_PLAYOFF;

  if (requiresGroupAssignments) {
    await assignParticipantsToGroups(tournamentId, { mode: "auto" });
  } else {
    const { ordered, shouldPersistSeeds } = await orderTournamentParticipantsForSeeding(
      tournament.participants,
      tournament.seedingMethod,
      tournament.seasonId,
    );
    if (shouldPersistSeeds) {
      await Promise.all(
        ordered.map((participant, index) =>
          db.tournamentRegistration.update({
            where: { id: participant.id },
            data: { seed: index + 1 },
          }),
        ),
      );
    }
  }

  const playoffStage = await db.tournamentStage.findFirst({
    where: { tournamentId, type: StageType.PLAYOFF },
    include: { bracket: true },
  });

  if (
    playoffStage?.bracket &&
    (isDirectPlayoffFormat(tournament.format) ||
      isCustomDirectPlayoff(tournament.format, tournament.formatBlueprintJson) ||
      tournament.format === TournamentFormat.GROUPS_PLAYOFF)
  ) {
    const bracketSize =
      tournament.format === TournamentFormat.GROUPS_PLAYOFF
        ? getDefaultPlayoffSize(tournament)
        : nextPowerOfTwo(confirmedParticipants);
    await db.playoffBracket.update({
      where: { id: playoffStage.bracket.id },
      data: { size: bracketSize },
    });
    await db.tournamentStage.update({
      where: { id: playoffStage.id },
      data: { roundsCount: Math.log2(bracketSize) },
    });
  }

  await db.matchResultSubmission.deleteMany({
    where: { match: { tournamentId } },
  });
  await db.matchSchedule.deleteMany({
    where: { match: { tournamentId } },
  });
  await db.match.deleteMany({
    where: { tournamentId },
  });
  await db.bracketSlot.deleteMany({
    where: { bracket: { tournamentId } },
  });

  const createdMatches = await generateTournamentMatches(tournamentId);

  if (!createdMatches.length) {
    throw new Error("Не удалось создать матчи. Проверьте распределение участников по лигам и настройки формата.");
  }

  if (!tournament.captainsCreateTeamMatches) {
    await generateTournamentSchedule(tournamentId, { overwrite: true });
  }

  await db.tournamentStage.updateMany({
    where: { tournamentId },
    data: { status: StageStatus.PENDING },
  });

  const firstStage = await db.tournamentStage.findFirst({
    where: { tournamentId },
    orderBy: { orderIndex: "asc" },
  });

  if (firstStage) {
    const activatedAt = new Date();
    await db.tournamentStage.update({
      where: { id: firstStage.id },
      data: { status: StageStatus.ACTIVE, startsAt: firstStage.startsAt ?? activatedAt },
    });
  }
  await applyTournamentAbsenceRatingPenalty(tournamentId);

  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.IN_PROGRESS,
      registrationClosedAt: tournament.registrationClosedAt ?? new Date(),
    },
  });

  if (!tournamentNotificationsEnabled(tournament)) {
    return db.tournament.findUnique({ where: { id: tournamentId } });
  }

  await Promise.all(
    tournament.participants.map((player) =>
      createNotification({
        userId: player.user.id,
        title: "Турнир стартовал",
        body: `${tournament.title}: матчи, расписание и турнирная структура уже доступны.`,
        type: NotificationType.TOURNAMENT,
        link: `/tournaments/${tournament.id}`,
      }),
    ),
  );

  await notifyActiveTournamentRoundsStarted(tournamentId);

  return db.tournament.findUnique({ where: { id: tournamentId } });
}

async function removeIncompleteRosterRegistrations(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      title: true,
      participantMode: true,
      rosterSize: true,
      notificationsEnabled: true,
      participants: {
        where: {
          status: { in: [ParticipantStatus.PENDING, ParticipantStatus.CONFIRMED, ParticipantStatus.WAITLIST] },
        },
        select: {
          id: true,
          userId: true,
          rosterMembers: {
            select: {
              id: true,
              userId: true,
              status: true,
              isCaptain: true,
            },
          },
        },
      },
    },
  });

  if (!tournament || tournament.participantMode === TournamentParticipantMode.SINGLE) {
    return { removedCount: 0 };
  }

  const incompleteRegistrations = tournament.participants.filter((participant) => {
    const acceptedMembersCount = participant.rosterMembers.filter((member) => member.status === TeamInviteStatus.ACCEPTED).length;
    return acceptedMembersCount < tournament.rosterSize;
  });

  if (!incompleteRegistrations.length) {
    return { removedCount: 0 };
  }

  const now = new Date();
  const registrationIds = incompleteRegistrations.map((participant) => participant.id);

  await db.$transaction(async (tx) => {
    await tx.tournamentRegistration.updateMany({
      where: {
        id: { in: registrationIds },
        status: { not: ParticipantStatus.REMOVED },
      },
      data: {
        status: ParticipantStatus.REMOVED,
        groupId: null,
        seed: null,
        stageSeed: null,
        checkedInAt: null,
      },
    });

    await tx.tournamentRegistrationMember.updateMany({
      where: {
        registrationId: { in: registrationIds },
        status: TeamInviteStatus.PENDING,
      },
      data: {
        status: TeamInviteStatus.DECLINED,
        respondedAt: now,
      },
    });
  });

  if (tournamentNotificationsEnabled(tournament)) {
    await Promise.all(
      incompleteRegistrations.map((participant) => {
        const captain = participant.rosterMembers.find((member) => member.isCaptain) ?? participant.rosterMembers[0];
        return captain
          ? createNotification({
              userId: captain.userId,
              title: "Состав снят с турнира",
              body: `${tournament.title}: состав не был укомплектован до закрытия регистрации, поэтому заявка удалена из турнира.`,
              type: NotificationType.TOURNAMENT,
              link: `/tournaments/${tournament.id}`,
              dedupeKey: `incomplete-roster-removed:${participant.id}`,
              dedupeWithinHours: 24 * 365,
            })
          : Promise.resolve(null);
      }),
    );
  }

  await syncTournamentPreviewGroups(tournamentId).catch(() => null);

  return { removedCount: incompleteRegistrations.length };
}

export async function syncTournamentLifecycleStatus(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        select: { id: true, userId: true },
      },
      matches: {
        select: { id: true, status: true, stageId: true },
      },
      stages: {
        include: {
          bracket: {
            include: {
              matches: {
                select: { id: true },
              },
            },
          },
          groups: {
            include: {
              standings: {
                include: {
                  participant: {
                    select: {
                      userId: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) {
    throw new Error("Tournament not found");
  }

  const confirmedParticipants = tournament.participants.length;
  const hasMatches = tournament.matches.length > 0;
  const allMatchesCompleted =
    hasMatches && tournament.matches.every((match) => TERMINAL_MATCH_STATUSES.has(match.status));
  const now = new Date();
  const registrationStartsAt = getTournamentRegistrationOpenAt(tournament);
  const nextDateStatus =
    tournament.autoOpenRegistration && tournament.status === TournamentStatus.DRAFT && registrationStartsAt <= now
      ? TournamentStatus.REGISTRATION_OPEN
      : tournament.status === TournamentStatus.REGISTRATION_OPEN && confirmedParticipants >= tournament.maxParticipants
        ? TournamentStatus.AWAITING_START
        : null;

  if (nextDateStatus) {
    if (nextDateStatus === TournamentStatus.AWAITING_START) {
      await removeIncompleteRosterRegistrations(tournamentId);
      await applyTournamentAbsenceRatingPenalty(tournamentId);
    }

    const dateStatusTournament = await db.tournament.update({
      where: { id: tournamentId },
      data: {
        status: nextDateStatus,
        registrationClosedAt:
          nextDateStatus === TournamentStatus.AWAITING_START && !tournament.registrationClosedAt
            ? now
            : nextDateStatus === TournamentStatus.REGISTRATION_OPEN
              ? null
              : tournament.registrationClosedAt,
      },
    });
    invalidateTournamentRules(tournamentId);
    return dateStatusTournament;
  }

  if (tournament.format === TournamentFormat.CUSTOM) {
    const leagueStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
    const playoffStages = tournament.stages.filter((stage) => stage.type === StageType.PLAYOFF && stage.bracket);
    const hasLeagueMatches = !!leagueStage && tournament.matches.some((match) => match.stageId === leagueStage.id);
    const hasPlayoffMatches = playoffStages.some((stage) => (stage.bracket?.matches.length ?? 0) > 0);
    const leagueMatchesCompleted =
      !!leagueStage &&
      tournament.matches.filter((match) => match.stageId === leagueStage.id).length > 0 &&
      tournament.matches
        .filter((match) => match.stageId === leagueStage.id)
        .every((match) => TERMINAL_MATCH_STATUSES.has(match.status));

    if (leagueMatchesCompleted && playoffStages.length && !hasPlayoffMatches) {
      await ensureCustomPlayoffMatchesGenerated(tournamentId);
      await generatePlayoffFromGroups(tournamentId);
      await generateTournamentSchedule(tournamentId, { overwrite: false });

      if (leagueStage) {
        await db.tournamentStage.update({
          where: { id: leagueStage.id },
          data: { status: StageStatus.COMPLETED },
        });
      }

      const firstPlayoffStage = playoffStages[0];
      if (firstPlayoffStage) {
        const activatedAt = new Date();
        await db.tournamentStage.update({
          where: { id: firstPlayoffStage.id },
          data: { status: StageStatus.ACTIVE, startsAt: firstPlayoffStage.startsAt ?? activatedAt },
        });
      }

      const updatedTournament = await db.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.IN_PROGRESS },
      });

      // Playoff was generated from groups: status, stages and matches all changed.
      invalidateTournamentAll(tournamentId);
      await notifyActiveTournamentRoundsStarted(tournamentId);

      return updatedTournament;
    }

    if (leagueStage && hasLeagueMatches && !hasPlayoffMatches && allMatchesCompleted) {
      const updatedTournament = await db.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.IN_PROGRESS },
      });

      invalidateTournamentRules(tournamentId);
      await notifyActiveTournamentRoundsStarted(tournamentId);

      return updatedTournament;
    }
  }

  const nextStatus =
    allMatchesCompleted
      ? TournamentStatus.COMPLETED
      : confirmedParticipants >= tournament.maxParticipants && tournament.status === TournamentStatus.REGISTRATION_OPEN
        ? TournamentStatus.AWAITING_START
        : null;

  if (!nextStatus) {
    if (tournament.status === TournamentStatus.IN_PROGRESS) {
      await notifyActiveTournamentRoundsStarted(tournamentId);
    }

    return tournament;
  }

  if (nextStatus === TournamentStatus.AWAITING_START) {
    await removeIncompleteRosterRegistrations(tournamentId);
    await applyTournamentAbsenceRatingPenalty(tournamentId);
  }

  const updatedTournament = await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: nextStatus,
      registrationClosedAt:
        nextStatus === TournamentStatus.AWAITING_START && !tournament.registrationClosedAt ? new Date() : tournament.registrationClosedAt,
    },
  });

  if (nextStatus === TournamentStatus.AWAITING_START && tournamentNotificationsEnabled(tournament)) {
    await createNotificationsForUsers({
      userIds: tournament.participants.map((participant) => participant.userId),
      title: "Регистрация закрыта",
      body: `${tournament.title}: набор участников завершён. Ожидается запуск турнира.`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${tournament.id}`,
      dedupeWithinHours: 24,
    });
  }

  if (nextStatus === TournamentStatus.COMPLETED) {
    await notifyTournamentCompleted(tournamentId);
  }

  invalidateTournamentRules(tournamentId);

  return updatedTournament;
}

async function createPenaltyMatch(match: {
  id: string;
  tournamentId: string;
  stageId: string | null;
  bracketId: string | null;
  round: number;
  matchNumber: number;
  bracket: string;
  seriesKey: string | null;
  legNumber?: number | null;
  seriesWinsRequired?: number | null;
  seriesMatchNumber?: number | null;
  player1Id: string | null;
  player2Id: string | null;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
  nextMatchId: string | null;
  nextMatchSlot: number | null;
  loserNextMatchId: string | null;
  loserNextMatchSlot: number | null;
  isThirdPlaceMatch: boolean;
}) {
  if (!match.seriesKey) {
    return null;
  }

  const penaltyMatchId = `penalty:${match.id}`;
  const existingPenalty = await db.match.findFirst({
    where: {
      tournamentId: match.tournamentId,
      seriesKey: match.seriesKey,
      isPenaltyTiebreak: true,
      round: match.round,
      matchNumber: match.matchNumber,
      legNumber: match.legNumber ?? null,
      seriesMatchNumber: match.seriesMatchNumber ?? null,
    },
  });

  if (existingPenalty) {
    return existingPenalty;
  }

  return db.match.upsert({
    where: { id: penaltyMatchId },
    update: {},
    create: {
      id: penaltyMatchId,
      tournamentId: match.tournamentId,
      stageId: match.stageId,
      bracketId: match.bracketId,
      round: match.round,
      matchNumber: match.matchNumber,
      bracket: match.bracket,
      seriesKey: match.seriesKey,
      legNumber: match.legNumber ?? null,
      seriesWinsRequired: match.seriesWinsRequired ?? null,
      seriesMatchNumber: match.seriesMatchNumber ?? null,
      isPenaltyTiebreak: true,
      isThirdPlaceMatch: match.isThirdPlaceMatch,
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      participant1EntryId: match.participant1EntryId,
      participant2EntryId: match.participant2EntryId,
      nextMatchId: match.nextMatchId,
      nextMatchSlot: match.nextMatchSlot,
      loserNextMatchId: match.loserNextMatchId,
      loserNextMatchSlot: match.loserNextMatchSlot,
      status: match.player1Id && match.player2Id ? MatchStatus.READY : MatchStatus.PENDING,
    },
  });
}

const TEAM_CAPTAIN_TIEBREAK_NOTE = "Решающий матч капитанов";

async function getTeamCaptainIds(entryIds: string[]) {
  const registrations = await db.tournamentRegistration.findMany({
    where: { id: { in: entryIds } },
    select: {
      id: true,
      userId: true,
      rosterMembers: {
        where: { isCaptain: true, status: TeamInviteStatus.ACCEPTED },
        select: { userId: true },
        take: 1,
      },
    },
  });

  return new Map(
    registrations.map((registration) => [
      registration.id,
      registration.rosterMembers[0]?.userId ?? registration.userId,
    ]),
  );
}

async function createTeamCaptainTiebreakMatch(params: {
  sourceMatch: {
    id: string;
    tournamentId: string;
    stageId: string | null;
    bracketId: string | null;
    round: number;
    matchNumber: number;
    bracket: string;
    seriesKey: string | null;
    isThirdPlaceMatch: boolean;
    nextMatchId: string | null;
    nextMatchSlot: number | null;
    loserNextMatchId: string | null;
    loserNextMatchSlot: number | null;
  };
  participant1EntryId: string;
  participant2EntryId: string;
  legNumber: number;
}) {
  if (!params.sourceMatch.seriesKey) return null;

  const existing = await db.match.findFirst({
    where: { seriesKey: params.sourceMatch.seriesKey, isTeamCaptainTiebreak: true },
  });
  if (existing) return existing;

  const captainIds = await getTeamCaptainIds([
    params.participant1EntryId,
    params.participant2EntryId,
  ]);
  const player1Id = captainIds.get(params.participant1EntryId) ?? null;
  const player2Id = captainIds.get(params.participant2EntryId) ?? null;
  const id = `captain-tiebreak:${params.sourceMatch.seriesKey}`;

  const tiebreak = await db.match.upsert({
    where: { id },
    update: {},
    create: {
      id,
      tournamentId: params.sourceMatch.tournamentId,
      stageId: params.sourceMatch.stageId,
      bracketId: params.sourceMatch.bracketId,
      round: params.sourceMatch.round,
      matchNumber: params.sourceMatch.matchNumber,
      bracket: params.sourceMatch.bracket,
      seriesKey: params.sourceMatch.seriesKey,
      legNumber: params.legNumber,
      isCaptainAssignedTeamMatch: true,
      isTeamCaptainTiebreak: true,
      isThirdPlaceMatch: params.sourceMatch.isThirdPlaceMatch,
      player1Id,
      player2Id,
      participant1EntryId: params.participant1EntryId,
      participant2EntryId: params.participant2EntryId,
      nextMatchId: params.sourceMatch.nextMatchId,
      nextMatchSlot: params.sourceMatch.nextMatchSlot,
      loserNextMatchId: params.sourceMatch.loserNextMatchId,
      loserNextMatchSlot: params.sourceMatch.loserNextMatchSlot,
      status: player1Id && player2Id ? MatchStatus.READY : MatchStatus.PENDING,
      notes: TEAM_CAPTAIN_TIEBREAK_NOTE,
    },
  });

  if (player1Id && player2Id) {
    await notifyMatchReady(tiebreak.id);
  }

  invalidateTournamentSchedule(params.sourceMatch.tournamentId);
  return tiebreak;
}

async function resolveCaptainTeamPlayoffSeriesIfCompleted(match: {
  id: string;
  tournamentId: string;
  bracketId: string | null;
  seriesKey: string | null;
  isCaptainAssignedTeamMatch: boolean;
  isTeamCaptainTiebreak: boolean;
  status: MatchStatus;
  winnerId: string | null;
  winnerEntryId: string | null;
  player1Id: string | null;
  player2Id: string | null;
  player1Score: number | null;
  player2Score: number | null;
  player1PenaltyScore: number | null;
  player2PenaltyScore: number | null;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
  tournament: {
    participantMode: TournamentParticipantMode;
    captainsCreateTeamMatches: boolean;
  };
}) {
  if (
    !match.bracketId ||
    !match.seriesKey ||
    !match.isCaptainAssignedTeamMatch ||
    match.tournament.participantMode !== TournamentParticipantMode.TEAM ||
    !match.tournament.captainsCreateTeamMatches
  ) {
    return false;
  }

  if (match.isTeamCaptainTiebreak) {
    const isCompleted =
      match.status === MatchStatus.CONFIRMED ||
      match.status === MatchStatus.FINISHED ||
      match.status === MatchStatus.FORFEIT;
    const player1Won =
      match.player1Score !== null &&
      match.player2Score !== null &&
      (match.player1Score > match.player2Score ||
        (match.player1Score === match.player2Score &&
          match.player1PenaltyScore !== null &&
          match.player2PenaltyScore !== null &&
          match.player1PenaltyScore > match.player2PenaltyScore));
    const player2Won =
      match.player1Score !== null &&
      match.player2Score !== null &&
      (match.player2Score > match.player1Score ||
        (match.player1Score === match.player2Score &&
          match.player1PenaltyScore !== null &&
          match.player2PenaltyScore !== null &&
          match.player2PenaltyScore > match.player1PenaltyScore));
    const winnerId = match.winnerId ?? (player1Won ? match.player1Id : player2Won ? match.player2Id : null);
    const winnerEntryId =
      match.winnerEntryId ??
      (winnerId === match.player1Id
        ? match.participant1EntryId
        : winnerId === match.player2Id
          ? match.participant2EntryId
          : null);

    if (
      isCompleted &&
      winnerId &&
      winnerEntryId
    ) {
      if (winnerId !== match.winnerId || winnerEntryId !== match.winnerEntryId) {
        await db.match.update({
          where: { id: match.id },
          data: { winnerId, winnerEntryId },
        });
      }

      const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
      const loserEntryId =
        winnerEntryId === match.participant1EntryId
          ? match.participant2EntryId
          : match.participant1EntryId;
      await advanceResolvedWinnerForMatch(
        match.id,
        winnerId,
        loserId,
        winnerEntryId,
        loserEntryId,
      );
    }
    return true;
  }

  const seriesMatches = await db.match.findMany({
    where: { seriesKey: match.seriesKey },
    orderBy: [{ legNumber: "asc" }, { createdAt: "asc" }],
  });
  const baseMatches = seriesMatches.filter(
    (item) => item.isCaptainAssignedTeamMatch && !item.isTeamCaptainTiebreak && !item.isPenaltyTiebreak,
  );

  if (
    !baseMatches.length ||
    !baseMatches.every(
      (item) =>
        (item.status === MatchStatus.CONFIRMED ||
          item.status === MatchStatus.FINISHED ||
          item.status === MatchStatus.FORFEIT) &&
        item.player1Score !== null &&
        item.player2Score !== null,
    )
  ) {
    return true;
  }

  const resolution = resolveCaptainTeamPlayoffAggregate(baseMatches);
  if (resolution.state === "pending") return true;

  const sourceMatch =
    baseMatches.find((item) => item.nextMatchId && item.nextMatchSlot) ?? baseMatches[0];
  const existingTiebreak = seriesMatches.find((item) => item.isTeamCaptainTiebreak);

  if (resolution.state === "tied") {
    if (!existingTiebreak) {
      const lastLegNumber = Math.max(...baseMatches.map((item) => item.legNumber ?? 1));
      await createTeamCaptainTiebreakMatch({
        sourceMatch,
        participant1EntryId: resolution.participant1EntryId,
        participant2EntryId: resolution.participant2EntryId,
        legNumber: lastLegNumber + 1,
      });
    }
    return true;
  }

  if (existingTiebreak && existingTiebreak.status !== MatchStatus.CANCELLED) {
    await db.match.update({
      where: { id: existingTiebreak.id },
      data: { status: MatchStatus.CANCELLED },
    });
  }

  const captainIds = await getTeamCaptainIds([
    resolution.participant1EntryId,
    resolution.participant2EntryId,
  ]);
  const winnerId = captainIds.get(resolution.winnerEntryId) ?? null;
  const loserId = captainIds.get(resolution.loserEntryId) ?? null;

  if (winnerId) {
    await advanceResolvedWinnerForMatch(
      sourceMatch.id,
      winnerId,
      loserId,
      resolution.winnerEntryId,
      resolution.loserEntryId,
    );
  }

  return true;
}

async function resolveBestOfSeriesIfCompleted(match: {
  id: string;
  tournamentId: string;
  bracketId: string | null;
  seriesKey: string | null;
  seriesWinsRequired: number | null;
}) {
  if (!match.seriesKey || !match.seriesWinsRequired || match.seriesWinsRequired <= 1) {
    return false;
  }
  const winsRequired = match.seriesWinsRequired;

  const allSeriesMatches = await db.match.findMany({
    where: { seriesKey: match.seriesKey },
    orderBy: [{ seriesMatchNumber: "asc" }, { legNumber: "asc" }, { createdAt: "asc" }],
  });
  const penaltyMatches = allSeriesMatches.filter((item) => item.isPenaltyTiebreak);
  const seriesMatches = allSeriesMatches.filter((item) => !item.isPenaltyTiebreak);

  for (const penaltyMatch of penaltyMatches) {
    if (!(penaltyMatch.status === MatchStatus.CONFIRMED || penaltyMatch.status === MatchStatus.FINISHED) || !penaltyMatch.winnerId) {
      continue;
    }

    const exactLinkedMatch = seriesMatches.find(
      (item) =>
        item.player1Score !== null &&
        item.player2Score !== null &&
        item.player1Score === item.player2Score &&
        item.round === penaltyMatch.round &&
        item.matchNumber === penaltyMatch.matchNumber &&
        (item.legNumber ?? null) === (penaltyMatch.legNumber ?? null),
    );
    const linkedMatch =
      exactLinkedMatch ??
      seriesMatches.find(
        (item) =>
          item.player1Score !== null &&
          item.player2Score !== null &&
          item.player1Score === item.player2Score &&
          !item.winnerId &&
          item.round === penaltyMatch.round &&
          item.matchNumber === penaltyMatch.matchNumber &&
          (item.legNumber ?? null) === (penaltyMatch.legNumber ?? null),
      ) ??
      seriesMatches.find(
        (item) =>
          item.player1Score !== null &&
          item.player2Score !== null &&
          item.player1Score === item.player2Score &&
          !item.winnerId,
      );

    if (!linkedMatch) {
      continue;
    }

    const winnerEntryId =
      penaltyMatch.winnerId === linkedMatch.player1Id
        ? linkedMatch.participant1EntryId
        : penaltyMatch.winnerId === linkedMatch.player2Id
          ? linkedMatch.participant2EntryId
          : null;

    await db.match.update({
      where: { id: linkedMatch.id },
      data: {
        winnerId: penaltyMatch.winnerId,
        winnerEntryId,
        player1PenaltyScore: penaltyMatch.player1Score,
        player2PenaltyScore: penaltyMatch.player2Score,
      },
    });

    linkedMatch.winnerId = penaltyMatch.winnerId;
    linkedMatch.winnerEntryId = winnerEntryId;
    linkedMatch.player1PenaltyScore = penaltyMatch.player1Score;
    linkedMatch.player2PenaltyScore = penaltyMatch.player2Score;
  }

  const confirmedMatches = seriesMatches.filter((item) => item.status === MatchStatus.CONFIRMED || item.status === MatchStatus.FINISHED);

  for (const seriesMatch of confirmedMatches) {
    if (!seriesMatch.winnerId || seriesMatch.winnerEntryId) {
      continue;
    }

    const { winnerEntryId } = getMatchWinnerAndLoser(seriesMatch);
    if (!winnerEntryId) {
      continue;
    }

    await db.match.update({
      where: { id: seriesMatch.id },
      data: { winnerEntryId },
    });
    seriesMatch.winnerEntryId = winnerEntryId;
  }

  for (const seriesMatch of confirmedMatches) {
    if (seriesMatch.winnerId || seriesMatch.player1Score === null || seriesMatch.player2Score === null || seriesMatch.player1Score !== seriesMatch.player2Score) {
      continue;
    }

    const linkedPenalty = penaltyMatches.find(
      (item) =>
        item.round === seriesMatch.round &&
        item.matchNumber === seriesMatch.matchNumber &&
        (item.legNumber ?? null) === (seriesMatch.legNumber ?? null),
    );

    if (!linkedPenalty) {
      await createPenaltyMatch(seriesMatch);
    }

    if (!match.bracketId) {
      await recalculateGroupStandings(match.tournamentId);
    }
    return true;
  }

  const winsByEntryId = new Map<string, number>();

  for (const seriesMatch of confirmedMatches) {
    const { winnerEntryId } = getMatchWinnerAndLoser(seriesMatch);
    if (!winnerEntryId) continue;
    winsByEntryId.set(winnerEntryId, (winsByEntryId.get(winnerEntryId) ?? 0) + 1);
  }

  const winnerEntryId = Array.from(winsByEntryId.entries()).find(([, wins]) => wins >= winsRequired)?.[0] ?? null;
  if (!winnerEntryId) {
    if (!match.bracketId) {
      await recalculateGroupStandings(match.tournamentId);
    }
    return true;
  }

  const winnerMatch = confirmedMatches.find((item) => item.participant1EntryId === winnerEntryId || item.participant2EntryId === winnerEntryId);
  if (!winnerMatch) {
    await syncTournamentLifecycleStatus(match.tournamentId);
    return true;
  }

  const winnerId = winnerMatch.participant1EntryId === winnerEntryId ? winnerMatch.player1Id : winnerMatch.player2Id;
  const loserId = winnerMatch.participant1EntryId === winnerEntryId ? winnerMatch.player2Id : winnerMatch.player1Id;
  const loserEntryId = winnerMatch.participant1EntryId === winnerEntryId ? winnerMatch.participant2EntryId : winnerMatch.participant1EntryId;

  await db.match.updateMany({
    where: {
      seriesKey: match.seriesKey,
      id: { not: match.id },
      isPenaltyTiebreak: false,
      status: {
        in: [
          MatchStatus.PENDING,
          MatchStatus.READY,
          MatchStatus.RESULT_SUBMITTED,
          MatchStatus.REJECTED,
          MatchStatus.SCHEDULED,
          MatchStatus.LIVE,
          MatchStatus.DISPUTED,
        ],
      },
    },
    data: { status: MatchStatus.CANCELLED },
  });

  if (match.bracketId && winnerId) {
    const advancementSource =
      seriesMatches.find((item) => item.nextMatchId && item.nextMatchSlot) ??
      confirmedMatches.find((item) => item.nextMatchId && item.nextMatchSlot) ??
      winnerMatch;
    await advanceResolvedWinnerForMatch(advancementSource.id, winnerId, loserId, winnerEntryId, loserEntryId);
  } else {
    await recalculateGroupStandings(match.tournamentId);
    await syncTournamentLifecycleStatus(match.tournamentId);
  }

  return true;
}

export async function resolveConfirmedMatch(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      playoffBracket: true,
      tournament: {
        select: {
          participantMode: true,
          captainsCreateTeamMatches: true,
        },
      },
    },
  });
  if (!match) throw new Error("Match not found");
  invalidatePlayerRatings();
  // This resolves a confirmed match: it advances winners (schedule) and can
  // reshape the bracket (structure). Status changes go through
  // syncTournamentLifecycleStatus, which busts rules itself. Bust both here up
  // front so every early-return path is covered.
  invalidateTournamentSchedule(match.tournamentId);
  invalidateTournamentStructure(match.tournamentId);

  if (await resolveCaptainTeamPlayoffSeriesIfCompleted(match)) {
    return;
  }

  if (await resolveBestOfSeriesIfCompleted(match)) {
    return;
  }

  if (!match.bracketId || !match.seriesKey) {
    if (match.winnerId) {
      const { winnerEntryId, loserId, loserEntryId } = getMatchWinnerAndLoser(match);
      await advanceResolvedWinnerForMatch(match.id, match.winnerId, loserId, winnerEntryId, loserEntryId);
    } else {
      await syncTournamentLifecycleStatus(match.tournamentId);
    }

    return;
  }

  if (match.isPenaltyTiebreak) {
    if (match.winnerId) {
      const { winnerEntryId, loserId, loserEntryId } = getMatchWinnerAndLoser(match);
      await advanceResolvedWinnerForMatch(match.id, match.winnerId, loserId, winnerEntryId, loserEntryId);
    } else {
      await syncTournamentLifecycleStatus(match.tournamentId);
    }

    return;
  }

  const seriesMatches = await db.match.findMany({
    where: {
      seriesKey: match.seriesKey,
    },
    orderBy: [{ isPenaltyTiebreak: "asc" }, { legNumber: "asc" }, { createdAt: "asc" }],
  });

  const penaltyMatch = seriesMatches.find((item) => item.isPenaltyTiebreak);
  const regularMatches = seriesMatches.filter((item) => !item.isPenaltyTiebreak);
  const legsCount = Math.max(1, Math.min(match.playoffBracket?.legsCount ?? 1, 2));

  if (legsCount === 1) {
    const firstMatch = regularMatches.find((item) => item.legNumber === 1) ?? regularMatches[0];
    if (!firstMatch || !(firstMatch.status === MatchStatus.CONFIRMED || firstMatch.status === MatchStatus.FINISHED)) {
      return;
    }

    if (firstMatch.winnerId) {
      const { winnerEntryId, loserId, loserEntryId } = getMatchWinnerAndLoser(firstMatch);
      await advanceResolvedWinnerForMatch(firstMatch.id, firstMatch.winnerId, loserId, winnerEntryId, loserEntryId);
      return;
    }

    if (!penaltyMatch) {
      await createPenaltyMatch(firstMatch);
    }

    await syncTournamentLifecycleStatus(firstMatch.tournamentId);
    return;
  }

  const baseLegs = regularMatches.filter((item) => (item.legNumber ?? 1) <= 2);
  const confirmedBaseLegs = baseLegs.filter((item) => item.status === MatchStatus.CONFIRMED || item.status === MatchStatus.FINISHED);

  if (confirmedBaseLegs.length < 2) {
    return;
  }

  const aggregatePlayer1 = confirmedBaseLegs.reduce((sum, item) => sum + (item.player1Score ?? 0), 0);
  const aggregatePlayer2 = confirmedBaseLegs.reduce((sum, item) => sum + (item.player2Score ?? 0), 0);

  if (aggregatePlayer1 === aggregatePlayer2) {
    if (
      match.winnerId &&
      match.winnerEntryId &&
      match.player1PenaltyScore !== null &&
      match.player2PenaltyScore !== null &&
      match.player1PenaltyScore !== match.player2PenaltyScore
    ) {
      const { loserId, loserEntryId } = getMatchWinnerAndLoser(match);
      await advanceResolvedWinnerForMatch(match.id, match.winnerId, loserId, match.winnerEntryId, loserEntryId);
      return;
    }

    if (!penaltyMatch) {
      await createPenaltyMatch(match);
    }
    await syncTournamentLifecycleStatus(match.tournamentId);
    return;
  }

  const aggregateWinnerId = aggregatePlayer1 > aggregatePlayer2 ? match.player1Id : match.player2Id;
  const aggregateWinnerEntryId = aggregatePlayer1 > aggregatePlayer2 ? match.participant1EntryId : match.participant2EntryId;
  const aggregateLoserId = aggregateWinnerId === match.player1Id ? match.player2Id : match.player1Id;
  const aggregateLoserEntryId = aggregateWinnerId === match.player1Id ? match.participant2EntryId : match.participant1EntryId;

  if (aggregateWinnerId) {
    await advanceResolvedWinnerForMatch(match.id, aggregateWinnerId, aggregateLoserId, aggregateWinnerEntryId, aggregateLoserEntryId);
  } else {
    await syncTournamentLifecycleStatus(match.tournamentId);
  }
}

export async function advanceMatch(matchId: string, winnerId: string, loserId?: string | null) {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");

  const winnerEntryId = winnerId === match.player1Id ? match.participant1EntryId : winnerId === match.player2Id ? match.participant2EntryId : null;
  const loserEntryId = loserId === match.player1Id ? match.participant1EntryId : loserId === match.player2Id ? match.participant2EntryId : null;

  await db.match.update({
    where: { id: matchId },
    data: {
      winnerId,
      status: MatchStatus.CONFIRMED,
    },
  });

  await advanceResolvedWinnerForMatch(matchId, winnerId, loserId, winnerEntryId, loserEntryId);
}
