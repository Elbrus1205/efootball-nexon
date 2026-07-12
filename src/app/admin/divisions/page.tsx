import { DivisionMatchStatus } from "@prisma/client";
import { DivisionAdminPanel } from "@/components/admin/division-admin-panel";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { autoResolveExpiredDivisionMatches, getDivisionSettings, syncDivisionSeasons } from "@/lib/services/divisions";

export const dynamic = "force-dynamic";

const statuses = new Set(Object.values(DivisionMatchStatus));

export default async function AdminDivisionsPage(props: { searchParams?: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  await requirePermission("divisions.manage");
  await syncDivisionSeasons();
  await autoResolveExpiredDivisionMatches();
  const settings = await getDivisionSettings();
  const status = searchParams?.status ?? "all";
  const matches = await db.divisionMatch.findMany({
    where: statuses.has(status as DivisionMatchStatus) ? { status: status as DivisionMatchStatus } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 80,
    include: {
      playerOne: { select: { name: true, email: true } },
      playerTwo: { select: { name: true, email: true } },
    },
  });
  const players = await db.divisionPlayer.findMany({
    orderBy: [{ division: "asc" }, { rating: "desc" }, { points: "desc" }],
    take: 80,
    include: {
      user: { select: { name: true, email: true } },
    },
  });
  const seasons = await db.divisionSeason.findMany({
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
    take: 12,
    include: {
      _count: { select: { archives: true } },
    },
  });
  const archivedRows = await db.divisionSeasonArchive.findMany({
    orderBy: [{ createdAt: "desc" }, { place: "asc" }],
    take: 30,
    include: {
      season: { select: { name: true, status: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <DivisionAdminPanel
      settings={{
        betaEnabled: settings.betaEnabled,
        coverImage: settings.coverImage,
        phaseStartsAt: settings.phaseStartsAt?.toISOString() ?? null,
        phaseEndsAt: settings.phaseEndsAt?.toISOString() ?? null,
        rulesText: settings.rulesText,
      }}
      matches={matches}
      players={players}
      seasons={seasons}
      archivedRows={archivedRows}
      currentStatus={status}
    />
  );
}
