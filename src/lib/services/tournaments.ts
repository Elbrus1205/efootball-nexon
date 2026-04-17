import {
  ClubSelectionMode,
  MatchStatus,
  NotificationType,
  ParticipantStatus,
  PlayoffType,
  StageStatus,
  StageType,
  TournamentFormat,
  TournamentStatus,
  type TournamentStage,
} from "@prisma/client";
import { db } from "@/lib/db";
import { getAvailableClubs } from "@/lib/clubs";
import { normalizeFormatBlueprint, type FormatBlueprint, type PlayoffSelectionRule } from "@/lib/format-blueprint";

function createGroupSourceRef(groupId: string, rank: number) {
  return `group:${groupId}:rank:${rank}`;
}
import { createNotification } from "@/lib/services/notifications";

type CustomPlayoffSettings = {
  mode: "custom";
  selections: PlayoffSelectionRule[];
  upperEntriesCount: number;
  lowerEntriesCount: number;
};

const TERMINAL_MATCH_STATUSES = new Set<MatchStatus>([
  MatchStatus.CONFIRMED,
  MatchStatus.FINISHED,
  MatchStatus.FORFEIT,
]);

function nextPowerOfTwo(value: number) {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(value, 2))));
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

    await db.match.update({
      where: { id: targetMatch.id },
      data: {
        ...(params.slot === 1
          ? { player1Id: params.userId, participant1EntryId: params.entryId }
          : { player2Id: params.userId, participant2EntryId: params.entryId }),
        status:
          nextPlayer1Id && nextPlayer2Id && targetMatch.status === MatchStatus.PENDING
            ? MatchStatus.READY
            : nextPlayer1Id && nextPlayer2Id && targetMatch.status === MatchStatus.SCHEDULED
              ? MatchStatus.SCHEDULED
              : targetMatch.status,
      },
    });
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

  await syncTournamentLifecycleStatus(match.tournamentId);
}

function isPowerOfTwo(value: number) {
  return value >= 2 && (value & (value - 1)) === 0;
}

function isDirectPlayoffFormat(format: TournamentFormat) {
  return format === TournamentFormat.SINGLE_ELIMINATION || format === TournamentFormat.DOUBLE_ELIMINATION;
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

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

async function ensureGroupStandings(groupId: string, participantIds: string[]) {
  await Promise.all(
    participantIds.map((participantId) =>
      db.groupStanding.upsert({
        where: { groupId_participantId: { groupId, participantId } },
        update: {},
        create: { groupId, participantId },
      }),
    ),
  );
}

async function createRoundRobinMatchesForEntries({
  tournamentId,
  stageId,
  groupId,
  entries,
  roundsCount = 1,
}: {
  tournamentId: string;
  stageId?: string;
  groupId?: string;
  entries: { id: string; userId: string }[];
  roundsCount?: number | null;
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
    status: MatchStatus;
  }[] = [];

  let matchNumber = 1;
  const cycles = Math.max(roundsCount ?? 1, 1);

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    let slots: ({ id: string; userId: string } | null)[] = entries.length % 2 === 0 ? [...entries] : [...entries, null];
    const roundsPerCycle = slots.length - 1;

    for (let roundIndex = 0; roundIndex < roundsPerCycle; roundIndex += 1) {
      for (let pairIndex = 0; pairIndex < slots.length / 2; pairIndex += 1) {
        const first = slots[pairIndex];
        const second = slots[slots.length - 1 - pairIndex];
        if (!first || !second) continue;

        const shouldSwapHomeAway = (cycle + roundIndex + pairIndex) % 2 === 1;
        const participant1 = shouldSwapHomeAway ? second : first;
        const participant2 = shouldSwapHomeAway ? first : second;

        data.push({
          tournamentId,
          stageId,
          groupId,
          round: cycle * roundsPerCycle + roundIndex + 1,
          matchNumber: matchNumber++,
          participant1EntryId: participant1.id,
          participant2EntryId: participant2.id,
          player1Id: participant1.userId,
          player2Id: participant2.userId,
          status: MatchStatus.READY,
        });
      }

      slots = [slots[0] ?? null, slots[slots.length - 1] ?? null, ...slots.slice(1, -1)];
    }
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
}: {
  tournamentId: string;
  stageId: string;
  bracketId: string;
  entries: { id: string; userId: string; seed: number | null }[];
  type: PlayoffType;
  legsCount: number;
  thirdPlaceMatch: boolean;
  sizeOverride?: number;
}) {
  const orderedEntries = [...entries].sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER));
  const bracketSize = sizeOverride && isPowerOfTwo(sizeOverride) ? sizeOverride : nextPowerOfTwo(orderedEntries.length);
  const rounds = Math.log2(bracketSize);
  const effectiveLegsCount = type === PlayoffType.DOUBLE ? 1 : Math.max(1, Math.min(legsCount, 2));
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
        const player1 = orderedEntries[index * 2];
        const player2 = orderedEntries[index * 2 + 1];
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
    const thirdPlace = await db.match.create({
      data: {
        tournamentId,
        stageId,
        bracketId,
        round: rounds,
        matchNumber: 2,
        bracket: "upper",
        seriesKey: createSeriesKey(bracketId, "upper", rounds, 2, "third-place"),
        legNumber: 1,
        isThirdPlaceMatch: true,
        status: MatchStatus.PENDING,
      },
    });

    await Promise.all(
      semifinalLegs.slice(0, 2).map((semifinal, index) =>
        db.match.updateMany({
          where: { seriesKey: semifinal.seriesKey },
          data: {
            loserNextMatchId: thirdPlace.id,
            loserNextMatchSlot: index === 0 ? 1 : 2,
          },
        }),
      ),
    );
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
    const leagueStage = await db.tournamentStage.create({
      data: {
        tournamentId: params.tournamentId,
        name: params.blueprint.leagueStageName,
        type: StageType.GROUP_STAGE,
        status: getStageStatus(false, params.tournament.status),
        orderIndex: 1,
        groupsCount: params.blueprint.divisionsCount,
        participantsPerGroup: params.blueprint.participantsPerGroup ?? undefined,
        roundsCount: params.blueprint.roundsCount,
        pointsForWin: params.tournament.pointsForWin,
        pointsForDraw: params.tournament.pointsForDraw,
        pointsForLoss: params.tournament.pointsForLoss,
        sortRules: params.tournament.sortRules,
        settingsJson: {
          mode: params.blueprint.openingStageMode === "LEAGUE" ? "custom-league" : "custom-groups",
          divisionsCount: params.blueprint.divisionsCount,
          roundsCount: params.blueprint.roundsCount,
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
    upperMatches.flatMap((match, index) => {
      const refs = [upperRefs[index * 2] ?? null, upperRefs[index * 2 + 1] ?? null];
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
    if (stage.bracket.matches.length) continue;

    const customSettings = parseCustomBracketSettings(stage.bracket.settingsJson);
    if (!customSettings) continue;

    await createPlayoffMatches({
      tournamentId,
      stageId: stage.id,
      bracketId: stage.bracket.id,
      entries: [],
      type: stage.bracket.type,
      legsCount: stage.bracket.legsCount,
      thirdPlaceMatch: stage.bracket.thirdPlaceMatch,
      sizeOverride: nextPowerOfTwo(Math.max(customSettings.upperEntriesCount, customSettings.lowerEntriesCount, 2)),
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
    const playoffStage = await db.tournamentStage.create({
      data: {
        tournamentId,
        name: "Playoff",
        type: StageType.PLAYOFF,
        status: stages.length ? StageStatus.PENDING : TournamentStatus.IN_PROGRESS === tournament.status ? StageStatus.ACTIVE : StageStatus.PENDING,
        orderIndex: stageOrder,
        roundsCount: Math.log2(nextPowerOfTwo(Math.max(tournament.participants.length, 2))),
      },
    });

    await db.playoffBracket.create({
      data: {
        type:
          tournament.playoffType ??
          (tournament.format === TournamentFormat.DOUBLE_ELIMINATION ? PlayoffType.DOUBLE : PlayoffType.SINGLE),
        tournamentId,
        stageId: playoffStage.id,
        size: nextPowerOfTwo(Math.max(tournament.participants.length, 2)),
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
    const ordered = tournament.seedingMethod === "RANDOM" ? shuffle(tournament.participants) : tournament.participants;
    await Promise.all(
      ordered.map((entry, index) =>
        db.tournamentRegistration.update({
          where: { id: entry.id },
          data: { groupId: groups[index % groups.length]?.id ?? null },
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

  return db.tournamentGroup.findMany({
    where: { stageId: groupStage.id },
    include: {
      members: { include: { user: true } },
      standings: { include: { participant: { include: { user: true } } } },
    },
    orderBy: { orderIndex: "asc" },
  });
}

export async function generateTournamentMatches(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      matches: true,
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
  if (tournament.matches.length) return tournament.matches;

  for (const stage of tournament.stages) {
    if (stage.type === StageType.LEAGUE) {
      await createRoundRobinMatchesForEntries({
        tournamentId,
        stageId: stage.id,
        entries: tournament.participants.map((entry) => ({ id: entry.id, userId: entry.userId })),
        roundsCount: stage.roundsCount,
      });
    }

    if (stage.type === StageType.GROUP_STAGE) {
      for (const group of stage.groups) {
        const members = group.members.map((entry) => ({ id: entry.id, userId: entry.userId }));
        if (members.length >= 2) {
          await createRoundRobinMatchesForEntries({
            tournamentId,
            stageId: stage.id,
            groupId: group.id,
            entries: members,
            roundsCount: stage.roundsCount,
          });
        }
      }
    }

    if (stage.type === StageType.PLAYOFF && stage.bracket) {
      const customSettings = tournament.format === TournamentFormat.CUSTOM ? parseCustomBracketSettings(stage.bracket.settingsJson) : null;

      if (customSettings) {
        continue;
      } else {
        await createPlayoffMatches({
          tournamentId,
          stageId: stage.id,
          bracketId: stage.bracket.id,
          entries: tournament.participants.map((entry) => ({ id: entry.id, userId: entry.userId, seed: entry.seed })),
          type: stage.bracket.type,
          legsCount: stage.bracket.legsCount,
          thirdPlaceMatch: stage.bracket.thirdPlaceMatch,
        });
      }
    }
  }

  if (tournament.status === TournamentStatus.REGISTRATION_CLOSED) {
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
  const freeClubs = shuffle(clubs.filter((club) => !usedClubs.includes(club.slug)));
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

export async function recalculateGroupStandings(tournamentId: string) {
  const groups = await db.tournamentGroup.findMany({
    where: { stage: { tournamentId } },
    include: {
      members: true,
      matches: true,
      standings: true,
    },
    orderBy: { orderIndex: "asc" },
  });

  for (const group of groups) {
    const base = new Map(
      group.members.map((member) => [
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

    for (const match of group.matches.filter((item) => item.status === MatchStatus.CONFIRMED || item.status === MatchStatus.FINISHED)) {
      if (!match.participant1EntryId || !match.participant2EntryId) continue;
      if (match.player1Score == null || match.player2Score == null) continue;

      const one = base.get(match.participant1EntryId);
      const two = base.get(match.participant2EntryId);
      if (!one || !two) continue;

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

    const stage = await db.tournamentStage.findUnique({ where: { id: group.stageId } });
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

  return db.tournamentGroup.findMany({
    where: { stage: { tournamentId } },
    include: {
      standings: {
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

    return seeded[0];
  }

  const groupStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
  const playoffStage = tournament.stages.find((stage) => stage.type === StageType.PLAYOFF);
  if (!groupStage || !playoffStage?.bracket) throw new Error("Stages for groups/playoff are not configured");

  const roundOneMatches = await db.match.findMany({
    where: {
      bracketId: playoffStage.bracket.id,
      round: 1,
      bracket: "upper",
    },
    orderBy: { matchNumber: "asc" },
  });

  await db.match.updateMany({
    where: { bracketId: playoffStage.bracket.id, round: 1 },
    data: {
      participant1EntryId: null,
      participant2EntryId: null,
      player1Id: null,
      player2Id: null,
    },
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

  const mappedSlots =
    existingRoundOneMappings.length > 0
      ? existingRoundOneMappings.map((slot) => ({
          round: slot.round,
          matchNumber: slot.matchNumber,
          slotNumber: slot.slotNumber,
          sourceRef: slot.sourceRef!,
        }))
      : (() => {
          const advancingPerGroup = groupStage.advancingPerGroup ?? 2;
          const qualified = groupStage.groups.flatMap((group) =>
            group.standings
              .filter((standing) => (standing.rank ?? 999) <= advancingPerGroup)
              .map((standing) => ({
                groupId: group.id,
                rank: standing.rank ?? 999,
                participantId: standing.participantId,
              })),
          );

          const ordered = qualified.sort((a, b) => a.rank - b.rank);

          return ordered.map((item, index) => ({
            round: 1,
            matchNumber: Math.floor(index / 2) + 1,
            slotNumber: (index % 2) + 1,
            sourceRef: createGroupSourceRef(item.groupId, item.rank),
          }));
        })();

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
          select: { id: true, player1Id: true, player2Id: true, status: true },
        })
      : await db.match.findMany({
          where: { id: match.id },
          select: { id: true, player1Id: true, player2Id: true, status: true },
        });

    await Promise.all(
      targetMatches.map((targetMatch) =>
        db.match.update({
          where: { id: targetMatch.id },
          data:
            input.slotNumber === 1
              ? {
                  participant1EntryId: slot.participantId ?? null,
                  player1Id: slot.participant?.userId ?? null,
                  status:
                    (slot.participant?.userId ?? null) && targetMatch.player2Id && targetMatch.status === MatchStatus.PENDING
                      ? MatchStatus.READY
                      : targetMatch.status,
                }
              : {
                  participant2EntryId: slot.participantId ?? null,
                  player2Id: slot.participant?.userId ?? null,
                  status:
                    (slot.participant?.userId ?? null) && targetMatch.player1Id && targetMatch.status === MatchStatus.PENDING
                      ? MatchStatus.READY
                      : targetMatch.status,
                },
        }),
      ),
    );
  }

  return slot;
}

export async function closeTournamentRegistration(tournamentId: string) {
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

  if (isDirectPlayoffFormat(tournament.format) && !isPowerOfTwo(confirmedParticipants)) {
    throw new Error("Для плей-офф нужно 2, 4, 8, 16 или 32 участника.");
  }

  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.REGISTRATION_CLOSED,
      registrationClosedAt: new Date(),
    },
  });

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

  return db.tournament.findUnique({ where: { id: tournamentId } });
}

export async function startTournament(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        include: { user: true },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      matches: true,
      stages: true,
    },
  });

  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== TournamentStatus.REGISTRATION_CLOSED) {
    throw new Error("Турнир можно запустить только после закрытия регистрации.");
  }

  const confirmedParticipants = tournament.participants.length;
  if (confirmedParticipants < 2) {
    throw new Error("Для старта турнира нужно минимум 2 участника.");
  }

  if (isDirectPlayoffFormat(tournament.format) && !isPowerOfTwo(confirmedParticipants)) {
    throw new Error("Для плей-офф нужно 2, 4, 8, 16 или 32 участника.");
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
    tournament.format === TournamentFormat.CUSTOM ||
    tournament.format === TournamentFormat.GROUPS ||
    tournament.format === TournamentFormat.GROUPS_PLAYOFF;

  if (requiresGroupAssignments) {
    await assignParticipantsToGroups(tournamentId, { mode: "auto" });
  }

  const playoffStage = await db.tournamentStage.findFirst({
    where: { tournamentId, type: StageType.PLAYOFF },
    include: { bracket: true },
  });

  if (playoffStage?.bracket && isDirectPlayoffFormat(tournament.format)) {
    const bracketSize = nextPowerOfTwo(confirmedParticipants);
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

  await generateTournamentSchedule(tournamentId, { overwrite: true });

  await db.tournamentStage.updateMany({
    where: { tournamentId },
    data: { status: StageStatus.PENDING },
  });

  const firstStage = await db.tournamentStage.findFirst({
    where: { tournamentId },
    orderBy: { orderIndex: "asc" },
  });

  if (firstStage) {
    await db.tournamentStage.update({
      where: { id: firstStage.id },
      data: { status: StageStatus.ACTIVE },
    });
  }

  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.IN_PROGRESS,
      registrationClosedAt: tournament.registrationClosedAt ?? new Date(),
    },
  });

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

  return db.tournament.findUnique({ where: { id: tournamentId } });
}

export async function syncTournamentLifecycleStatus(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: { status: ParticipantStatus.CONFIRMED },
        select: { id: true },
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
        await db.tournamentStage.update({
          where: { id: firstPlayoffStage.id },
          data: { status: StageStatus.ACTIVE },
        });
      }

      return db.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.IN_PROGRESS },
      });
    }

    if (leagueStage && hasLeagueMatches && !hasPlayoffMatches && allMatchesCompleted) {
      return db.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.IN_PROGRESS },
      });
    }
  }

  const nextStatus =
    allMatchesCompleted
      ? TournamentStatus.COMPLETED
      : confirmedParticipants >= tournament.maxParticipants && tournament.status === TournamentStatus.REGISTRATION_OPEN
        ? TournamentStatus.REGISTRATION_CLOSED
        : null;

  if (!nextStatus) {
    return tournament;
  }

  return db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: nextStatus,
      registrationClosedAt:
        nextStatus === TournamentStatus.REGISTRATION_CLOSED && !tournament.registrationClosedAt ? new Date() : tournament.registrationClosedAt,
    },
  });
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

  const existingPenalty = await db.match.findFirst({
    where: {
      seriesKey: match.seriesKey,
      isPenaltyTiebreak: true,
    },
  });

  if (existingPenalty) {
    return existingPenalty;
  }

  return db.match.create({
    data: {
      tournamentId: match.tournamentId,
      stageId: match.stageId,
      bracketId: match.bracketId,
      round: match.round,
      matchNumber: match.matchNumber,
      bracket: match.bracket,
      seriesKey: match.seriesKey,
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

async function createThirdSeriesMatch(match: {
  id: string;
  tournamentId: string;
  stageId: string | null;
  bracketId: string | null;
  round: number;
  matchNumber: number;
  bracket: string;
  seriesKey: string | null;
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

  const existingThirdMatch = await db.match.findFirst({
    where: {
      seriesKey: match.seriesKey,
      legNumber: 3,
      isPenaltyTiebreak: false,
    },
  });

  if (existingThirdMatch) {
    return existingThirdMatch;
  }

  return db.match.create({
    data: {
      tournamentId: match.tournamentId,
      stageId: match.stageId,
      bracketId: match.bracketId,
      round: match.round,
      matchNumber: match.matchNumber,
      bracket: match.bracket,
      seriesKey: match.seriesKey,
      legNumber: 3,
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

export async function resolveConfirmedMatch(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      playoffBracket: true,
    },
  });
  if (!match) throw new Error("Match not found");

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
  const player1Wins = confirmedBaseLegs.filter((item) => item.winnerId && item.winnerId === item.player1Id).length;
  const player2Wins = confirmedBaseLegs.filter((item) => item.winnerId && item.winnerId === item.player2Id).length;
  const splitWins = player1Wins > 0 && player2Wins > 0;
  const allDraws = player1Wins === 0 && player2Wins === 0;

  if (allDraws) {
    if (!penaltyMatch) {
      await createPenaltyMatch(match);
    }
    await syncTournamentLifecycleStatus(match.tournamentId);
    return;
  }

  if (splitWins) {
    if (aggregatePlayer1 === aggregatePlayer2) {
      if (!penaltyMatch) {
        await createPenaltyMatch(match);
      }
      await syncTournamentLifecycleStatus(match.tournamentId);
      return;
    }

    const thirdMatch = regularMatches.find((item) => item.legNumber === 3);
    if (!thirdMatch) {
      await createThirdSeriesMatch(match);
      await syncTournamentLifecycleStatus(match.tournamentId);
      return;
    }

    if (!(thirdMatch.status === MatchStatus.CONFIRMED || thirdMatch.status === MatchStatus.FINISHED)) {
      return;
    }

    if (thirdMatch.winnerId) {
      const { winnerEntryId, loserId, loserEntryId } = getMatchWinnerAndLoser(thirdMatch);
      await advanceResolvedWinnerForMatch(thirdMatch.id, thirdMatch.winnerId, loserId, winnerEntryId, loserEntryId);
      return;
    }

    if (!penaltyMatch) {
      await createPenaltyMatch(thirdMatch);
    }

    await syncTournamentLifecycleStatus(match.tournamentId);
    return;
  }

  if (aggregatePlayer1 === aggregatePlayer2) {
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

