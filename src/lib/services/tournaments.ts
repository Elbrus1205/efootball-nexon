import {
  MatchStatus,
  NotificationType,
  ParticipantStatus,
  PlayoffType,
  StageStatus,
  StageType,
  TournamentFormat,
  TournamentStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";

function nextPowerOfTwo(value: number) {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(value, 2))));
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
}: {
  tournamentId: string;
  stageId?: string;
  groupId?: string;
  entries: { id: string; userId: string }[];
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
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      data.push({
        tournamentId,
        stageId,
        groupId,
        round: i + 1,
        matchNumber: matchNumber++,
        participant1EntryId: entries[i]?.id,
        participant2EntryId: entries[j]?.id,
        player1Id: entries[i]?.userId,
        player2Id: entries[j]?.userId,
        status: MatchStatus.READY,
      });
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
}: {
  tournamentId: string;
  stageId: string;
  bracketId: string;
  entries: { id: string; userId: string; seed: number | null }[];
  type: PlayoffType;
}) {
  const orderedEntries = [...entries].sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER));
  const bracketSize = nextPowerOfTwo(orderedEntries.length);
  const rounds = Math.log2(bracketSize);
  const createdMatches: { id: string; round: number; matchNumber: number }[] = [];

  for (let round = 1; round <= rounds; round += 1) {
    const count = bracketSize / Math.pow(2, round);
    for (let matchNumber = 1; matchNumber <= count; matchNumber += 1) {
      const created = await db.match.create({
        data: {
          tournamentId,
          stageId,
          bracketId,
          round,
          matchNumber,
          bracket: "upper",
          status: round === 1 ? MatchStatus.READY : MatchStatus.PENDING,
        },
      });
      createdMatches.push({ id: created.id, round, matchNumber });
    }
  }

  for (const match of createdMatches.filter((item) => item.round < rounds)) {
    const next = createdMatches.find(
      (item) => item.round === match.round + 1 && item.matchNumber === Math.ceil(match.matchNumber / 2),
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
  await Promise.all(
    firstRound.map(async (match, index) => {
      const player1 = orderedEntries[index * 2];
      const player2 = orderedEntries[index * 2 + 1];

      await db.match.update({
        where: { id: match.id },
        data: {
          participant1EntryId: player1?.id,
          participant2EntryId: player2?.id,
          player1Id: player1?.userId,
          player2Id: player2?.userId,
        },
      });

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

  if (type === PlayoffType.DOUBLE) {
    await Promise.all(
      firstRound.map((match) =>
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

  const stages = [];

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
        tournamentId,
        stageId: playoffStage.id,
        type:
          tournament.playoffType ??
          (tournament.format === TournamentFormat.DOUBLE_ELIMINATION ? PlayoffType.DOUBLE : PlayoffType.SINGLE),
        size: nextPowerOfTwo(Math.max(tournament.participants.length, 2)),
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
          });
        }
      }
    }

    if (stage.type === StageType.PLAYOFF && stage.bracket) {
      await createPlayoffMatches({
        tournamentId,
        stageId: stage.id,
        bracketId: stage.bracket.id,
        entries: tournament.participants.map((entry) => ({ id: entry.id, userId: entry.userId, seed: entry.seed })),
        type: stage.bracket.type,
      });
    }
  }

  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.IN_PROGRESS,
      registrationClosedAt: new Date(),
    },
  });

  return db.match.findMany({ where: { tournamentId } });
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

  const groupStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
  const playoffStage = tournament.stages.find((stage) => stage.type === StageType.PLAYOFF);
  if (!groupStage || !playoffStage?.bracket) throw new Error("Stages for groups/playoff are not configured");

  const advancingPerGroup = groupStage.advancingPerGroup ?? 2;
  const qualified = groupStage.groups.flatMap((group) =>
    group.standings
      .filter((standing) => (standing.rank ?? 999) <= advancingPerGroup)
      .map((standing) => ({
        groupOrder: group.orderIndex,
        rank: standing.rank ?? 999,
        participantId: standing.participantId,
      })),
  );

  const ordered = qualified.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.groupOrder - b.groupOrder;
  });

  await db.bracketSlot.deleteMany({ where: { bracketId: playoffStage.bracket.id } });
  await db.match.updateMany({
    where: { bracketId: playoffStage.bracket.id, round: 1 },
    data: {
      participant1EntryId: null,
      participant2EntryId: null,
      player1Id: null,
      player2Id: null,
    },
  });

  await Promise.all(
    ordered.map((item, index) =>
      setBracketSlot({
        bracketId: playoffStage.bracket!.id,
        round: 1,
        matchNumber: Math.floor(index / 2) + 1,
        slotNumber: (index % 2) + 1,
        participantId: item.participantId,
        sourceType: "GROUP_RESULTS",
        sourceRef: `group-rank-${item.groupOrder}-${item.rank}`,
      }),
    ),
  );

  return db.playoffBracket.findUnique({
    where: { id: playoffStage.bracket.id },
    include: { slots: { include: { participant: { include: { user: true } } } } },
  });
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
  });

  if (match) {
    await db.match.update({
      where: { id: match.id },
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
    });
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
  if (!tournament.stages.length) await generateTournamentStages(tournamentId);
  if (!tournament.matches.length) {
    await generateTournamentMatches(tournamentId);
  }

  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.IN_PROGRESS,
      registrationClosedAt: new Date(),
    },
  });

  await Promise.all(
    tournament.participants.map((player) =>
      createNotification({
        userId: player.user.id,
        title: "Турнир стартовал",
        body: `${tournament.title}: регистрация закрыта, структура и матчи уже сформированы.`,
        type: NotificationType.TOURNAMENT,
        link: `/tournaments/${tournament.id}`,
      }),
    ),
  );

  return db.tournament.findUnique({ where: { id: tournamentId } });
}

export async function advanceMatch(matchId: string, winnerId: string, loserId?: string | null) {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");

  await db.match.update({
    where: { id: matchId },
    data: {
      winnerId,
      status: MatchStatus.CONFIRMED,
    },
  });

  if (match.nextMatchId && match.nextMatchSlot) {
    await db.match.update({
      where: { id: match.nextMatchId },
      data:
        match.nextMatchSlot === 1
          ? { player1Id: winnerId, status: MatchStatus.READY }
          : { player2Id: winnerId, status: MatchStatus.READY },
    });
  }

  if (match.loserNextMatchId && match.loserNextMatchSlot && loserId) {
    await db.match.update({
      where: { id: match.loserNextMatchId },
      data: match.loserNextMatchSlot === 1 ? { player1Id: loserId } : { player2Id: loserId },
    });
  }
}
