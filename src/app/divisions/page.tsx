import { redirect } from "next/navigation";
import { DivisionMatchStatus } from "@prisma/client";
import { DivisionModeClient } from "@/components/divisions/division-mode-client";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { autoResolveExpiredDivisionMatches, ensureDivisionPlayer, getDivisionLeaderboard, getDivisionSettings, isDivisionAdminRole } from "@/lib/services/divisions";

export const dynamic = "force-dynamic";

export default async function DivisionsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const session = await requireAuth();
  const settings = await getDivisionSettings();
  if (!isDivisionAdminRole(session.user.role)) {
    redirect("/tournaments");
  }

  await autoResolveExpiredDivisionMatches();
  const profile = await ensureDivisionPlayer(session.user.id);
  const queued = Boolean(await db.divisionQueueEntry.findUnique({ where: { userId: session.user.id } }));
  const activeMatches = await db.divisionMatch.findMany({
    where: {
      OR: [{ playerOneId: session.user.id }, { playerTwoId: session.user.id }],
      status: { in: [DivisionMatchStatus.WAITING_GAME, DivisionMatchStatus.WAITING_CONFIRMATION, DivisionMatchStatus.DISPUTED] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      submissions: true,
      playerOne: { select: { id: true, name: true, email: true, telegramUsername: true, divisionProfile: { select: { division: true } } } },
      playerTwo: { select: { id: true, name: true, email: true, telegramUsername: true, divisionProfile: { select: { division: true } } } },
    },
  });
  const rawHistory = await db.divisionMatchHistory.findMany({
    where: { playerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      match: { select: { id: true, status: true } },
    },
  });
  const opponents = rawHistory.length
    ? await db.user.findMany({
        where: { id: { in: rawHistory.map((item) => item.opponentId) } },
        select: { id: true, name: true, email: true, telegramUsername: true },
      })
    : [];
  const opponentById = new Map(opponents.map((opponent) => [opponent.id, opponent]));
  const history = rawHistory.map((item) => ({ ...item, opponent: opponentById.get(item.opponentId) ?? null }));
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const leaderboard = await getDivisionLeaderboard({ page, division: profile.division });
  const myLeaderboard = await getDivisionLeaderboard({ aroundUserId: session.user.id, division: profile.division });

  return (
    <DivisionModeClient
      currentUserId={session.user.id}
      profile={profile}
      queued={queued}
      activeMatches={activeMatches}
      history={history}
      leaderboard={leaderboard}
      myLeaderboard={myLeaderboard}
      leaderboardPage={page}
      betaEnabled={settings.betaEnabled}
      settings={{
        phaseStartsAt: settings.phaseStartsAt?.toISOString() ?? null,
        phaseEndsAt: settings.phaseEndsAt?.toISOString() ?? null,
        rulesText: settings.rulesText,
      }}
    />
  );
}
