import { DivisionMatchStatus } from "@prisma/client";
import { DivisionAdminPanel } from "@/components/admin/division-admin-panel";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { autoResolveExpiredDivisionMatches, getDivisionSettings } from "@/lib/services/divisions";

export const dynamic = "force-dynamic";

const statuses = new Set(Object.values(DivisionMatchStatus));

export default async function AdminDivisionsPage({ searchParams }: { searchParams?: { status?: string } }) {
  await requirePermission("divisions.manage");
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

  return <DivisionAdminPanel betaEnabled={settings.betaEnabled} matches={matches} players={players} currentStatus={status} />;
}
