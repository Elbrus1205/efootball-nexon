import { MatchStatus, ParticipantStatus, TournamentApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { TelegramAudienceScope } from "@/lib/telegram-publications";

const unresolvedMatchStatuses = [
  MatchStatus.READY,
  MatchStatus.SCHEDULED,
  MatchStatus.LIVE,
  MatchStatus.RESULT_SUBMITTED,
  MatchStatus.DISPUTED,
];

export async function getTelegramBroadcastRecipients(params: {
  scope: TelegramAudienceScope;
  tournamentId?: string;
  groupId?: string;
}) {
  const tournamentId = params.tournamentId?.trim();
  const groupId = params.groupId?.trim();

  if (params.scope !== "all" && !tournamentId) {
    throw new Error("Для выбранной аудитории укажите турнир.");
  }
  if (params.scope === "group" && !groupId) {
    throw new Error("Для групповой рассылки выберите группу.");
  }

  const users = await db.user.findMany({
    where: {
      telegramId: { not: null },
      isBanned: false,
      ...(params.scope === "participants"
        ? { tournamentEntries: { some: { tournamentId, status: ParticipantStatus.CONFIRMED } } }
        : {}),
      ...(params.scope === "group"
        ? { tournamentEntries: { some: { tournamentId, groupId, status: ParticipantStatus.CONFIRMED } } }
        : {}),
      ...(params.scope === "applicants"
        ? { tournamentRegistrationApplications: { some: { tournamentId, status: TournamentApplicationStatus.PENDING } } }
        : {}),
      ...(params.scope === "unresolved"
        ? {
            OR: [
              { playerOneMatches: { some: { tournamentId, status: { in: unresolvedMatchStatuses } } } },
              { playerTwoMatches: { some: { tournamentId, status: { in: unresolvedMatchStatuses } } } },
            ],
          }
        : {}),
    },
    select: { id: true, telegramId: true, telegramUsername: true },
  });

  return users.flatMap((user) => user.telegramId ? [{ ...user, telegramId: user.telegramId }] : []);
}
