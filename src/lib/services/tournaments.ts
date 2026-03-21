import { MatchStatus, NotificationType, TournamentFormat, TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";

export async function closeTournamentRegistration(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      matches: true,
    },
  });

  if (!tournament) throw new Error("Tournament not found");
  if (tournament.matches.length) return tournament;

  await db.tournament.update({
    where: { id: tournamentId },
    data: {
      status: TournamentStatus.REGISTRATION_CLOSED,
      registrationClosedAt: new Date(),
    },
  });

  const players = tournament.participants.map((entry) => entry.user);

  if (tournament.format === TournamentFormat.ROUND_ROBIN) {
    const matches = [];
    let matchNumber = 1;

    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        matches.push({
          tournamentId,
          round: i + 1,
          matchNumber: matchNumber++,
          player1Id: players[i]?.id,
          player2Id: players[j]?.id,
          status: MatchStatus.READY,
        });
      }
    }

    if (matches.length) await db.match.createMany({ data: matches });
  } else {
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(players.length, 2))));
    const rounds = Math.log2(bracketSize);
    const createdMatches: { id: string; round: number; matchNumber: number }[] = [];

    for (let round = 1; round <= rounds; round += 1) {
      const count = bracketSize / Math.pow(2, round);
      for (let matchNumber = 1; matchNumber <= count; matchNumber += 1) {
        const created = await db.match.create({
          data: {
            tournamentId,
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

    const firstRoundMatches = createdMatches.filter((item) => item.round === 1);
    await Promise.all(
      firstRoundMatches.map((match, index) =>
        db.match.update({
          where: { id: match.id },
          data: {
            player1Id: players[index * 2]?.id,
            player2Id: players[index * 2 + 1]?.id,
          },
        }),
      ),
    );

    if (tournament.format === TournamentFormat.DOUBLE_ELIMINATION) {
      await Promise.all(
        firstRoundMatches.map((match) =>
          db.match.create({
            data: {
              tournamentId,
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

  await db.tournament.update({
    where: { id: tournamentId },
    data: { status: TournamentStatus.IN_PROGRESS },
  });

  await Promise.all(
    players.map((player) =>
      createNotification({
        userId: player.id,
        title: "Турнир стартовал",
        body: `${tournament.title}: регистрация закрыта, сетка уже сформирована.`,
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
