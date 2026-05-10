import { db } from "@/lib/db";

const HOME_STATS_KEY = "home-stats";

type HomeStatsStore = Pick<typeof db, "siteContent">;

export type ArchivedHomeStats = {
  tournaments: number;
  prizePool: number;
  users: number;
  online: number;
};

const defaultArchivedHomeStats: ArchivedHomeStats = {
  tournaments: 0,
  prizePool: 0,
  users: 0,
  online: 0,
};

function normalizeArchivedHomeStats(value: unknown): ArchivedHomeStats {
  if (!value || typeof value !== "object") {
    return defaultArchivedHomeStats;
  }

  const stats = value as Partial<ArchivedHomeStats>;

  return {
    tournaments: Number.isFinite(stats.tournaments) ? Math.max(0, Number(stats.tournaments)) : 0,
    prizePool: Number.isFinite(stats.prizePool) ? Math.max(0, Number(stats.prizePool)) : 0,
    users: Number.isFinite(stats.users) ? Math.max(0, Number(stats.users)) : 0,
    online: Number.isFinite(stats.online) ? Math.max(0, Number(stats.online)) : 0,
  };
}

export function parsePrizePoolValue(prizePool?: string | null) {
  const value = prizePool?.replace(/[^\d]/g, "") ?? "";
  return value ? Number(value) : 0;
}

export async function getArchivedHomeStats(client: HomeStatsStore = db): Promise<ArchivedHomeStats> {
  const record = await client.siteContent.findUnique({
    where: { key: HOME_STATS_KEY },
    select: { body: true },
  });

  if (!record?.body) {
    return defaultArchivedHomeStats;
  }

  try {
    return normalizeArchivedHomeStats(JSON.parse(record.body));
  } catch {
    return defaultArchivedHomeStats;
  }
}

export async function addArchivedTournamentStats(
  tournament: { prizePool?: string | null },
  client: HomeStatsStore = db,
) {
  const current = await getArchivedHomeStats(client);
  const next: ArchivedHomeStats = {
    tournaments: current.tournaments + 1,
    prizePool: current.prizePool + parsePrizePoolValue(tournament.prizePool),
    users: current.users,
    online: current.online,
  };

  await client.siteContent.upsert({
    where: { key: HOME_STATS_KEY },
    update: { body: JSON.stringify(next) },
    create: { key: HOME_STATS_KEY, body: JSON.stringify(next) },
  });

  return next;
}
