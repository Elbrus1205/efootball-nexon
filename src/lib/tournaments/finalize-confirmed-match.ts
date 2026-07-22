import { NotificationType } from "@prisma/client";
import { syncUserAchievementsForUsers } from "@/lib/achievements";
import { ensureMatchLineupSnapshot } from "@/lib/services/match-lineups";
import { createNotification } from "@/lib/services/notifications";
import { recordConfirmedMatchReliability } from "@/lib/services/reliability";
import { publishTournamentResult, syncTournamentBulletin } from "@/lib/services/telegram-publications";
import { recalculateGroupStandings, resolveConfirmedMatch } from "@/lib/services/tournaments";

type FinalizeMatch = {
  id: string;
  tournamentId: string;
  tournament: { title: string; notificationsEnabled?: boolean | null };
  player1Id: string | null;
  player2Id: string | null;
};

async function createMatchOutcomeNotifications(
  match: FinalizeMatch & { winnerId: string | null },
  player1Score: number,
  player2Score: number,
) {
  if (match.tournament.notificationsEnabled === false) return;

  const playerIds = [match.player1Id, match.player2Id].filter(Boolean) as string[];

  await Promise.all(
    playerIds.map((userId) => {
      const isWinner = Boolean(match.winnerId) && userId === match.winnerId;
      const isDraw = !match.winnerId;

      return createNotification({
        userId,
        title: isDraw ? "Ничья подтверждена" : isWinner ? "Победа в матче" : "Матч завершён",
        body: `${match.tournament.title}: счёт ${player1Score}:${player2Score} подтверждён.${isWinner ? " Вы выиграли этот матч." : isDraw ? "" : " Победил соперник."}`,
        type: NotificationType.RESULT,
        link: `/tournaments/${match.tournamentId}`,
        dedupeKey: `match-result:${match.id}:${userId}`,
        dedupeWithinHours: 12,
      });
    }),
  );
}

/**
 * Runs every side effect that must follow a match becoming CONFIRMED: standings
 * recalculation, lineup snapshot, bracket resolution, reliability, outcome
 * notifications, achievements, and Telegram publications. Shared by the HTTP
 * submit route and the Telegram score-confirm callback so both paths stay
 * identical — divergence here would corrupt standings/ratings.
 *
 * `scheduleBackground` lets the caller defer the (slow, external) Telegram
 * publications; in a request context pass Next's `after`. Without it they run inline.
 */
export async function finalizeConfirmedMatch(params: {
  match: FinalizeMatch;
  winnerId: string | null;
  player1Score: number;
  player2Score: number;
  scheduleBackground?: (task: () => Promise<void>) => void;
}) {
  const { match } = params;

  await recalculateGroupStandings(match.tournamentId);
  await ensureMatchLineupSnapshot(match.id);
  await resolveConfirmedMatch(match.id);
  await recordConfirmedMatchReliability({
    userIds: [match.player1Id, match.player2Id],
    matchId: match.id,
    tournamentId: match.tournamentId,
  });
  await createMatchOutcomeNotifications({ ...match, winnerId: params.winnerId }, params.player1Score, params.player2Score);
  await syncUserAchievementsForUsers([match.player1Id, match.player2Id]);

  const publish = async () => {
    await Promise.all([
      publishTournamentResult(match.id).catch((error) => console.error("Failed to publish Telegram match result", error)),
      syncTournamentBulletin(match.tournamentId).catch((error) => console.error("Failed to update Telegram bulletin", error)),
    ]);
  };

  if (params.scheduleBackground) {
    params.scheduleBackground(publish);
  } else {
    await publish();
  }
}
