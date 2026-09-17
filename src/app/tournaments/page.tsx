import { Prisma, TournamentStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { DivisionPreviewCard } from "@/components/divisions/division-preview-card";
import { TournamentCatalog } from "@/components/tournaments/tournament-catalog";
import { db } from "@/lib/db";
import { getOrSetRedisJson } from "@/lib/redis-cache";
import { redisKey } from "@/lib/redis";

export const revalidate = 10;
const PAGE_SIZE = 12;

function logTiming(label: string, start: number) {
  if (process.env.NODE_ENV === "production") return;
  console.log(`${label}: ${(performance.now() - start).toFixed(3)}ms`);
}

type TournamentListRow = {
  id: string;
  title: string;
  status: TournamentStatus;
  startsAt: Date | string;
  endsAt: Date | string | null;
  maxParticipants: number;
  prizePool: string | null;
  hasCoverImage: boolean;
  updatedAt: Date | string;
  participantsCount: number;
};

function getTournamentCoverUrl(tournament: Pick<TournamentListRow, "id" | "hasCoverImage" | "updatedAt">) {
  return tournament.hasCoverImage ? `/api/tournaments/${tournament.id}/cover?w=720&h=405&q=84&v=${new Date(tournament.updatedAt).getTime()}` : null;
}

function loadTournamentList(archive: boolean, page: number) {
  const statusClause = archive
    ? Prisma.sql`t.status = 'COMPLETED'::"TournamentStatus"`
    : Prisma.sql`t.status <> 'COMPLETED'::"TournamentStatus"`;
  const orderClause = archive
    ? Prisma.sql`t."endsAt" DESC NULLS LAST, t."startsAt" DESC, t.id DESC`
    : Prisma.sql`t.status ASC, t."startsAt" ASC, t.id ASC`;

  return db.$queryRaw<TournamentListRow[]>(Prisma.sql`
    SELECT
      t.id,
      t.title,
      t.status::text AS status,
      t."startsAt",
      t."endsAt",
      t."maxParticipants",
      t."prizePool",
      (t."coverImage" IS NOT NULL AND t."coverImage" <> '') AS "hasCoverImage",
      t."updatedAt",
      (
        SELECT COUNT(*)::int
        FROM "TournamentRegistration" p
        WHERE p."tournamentId" = t.id AND p.status <> 'REMOVED'::"ParticipantStatus"
      ) AS "participantsCount"
    FROM "Tournament" t
    WHERE t."isTest" = false AND ${statusClause}
    ORDER BY ${orderClause}
    LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}
  `);
}

const getNextCachedTournamentList = unstable_cache(loadTournamentList, ["public-tournament-list", "catalog-v2"], {
  revalidate: 10,
  tags: ["public-tournaments"],
});

const getCachedTournamentList = (archive: boolean, page: number) => getOrSetRedisJson(
  redisKey(`tournaments:list:catalog-v2:${archive ? "archive" : "current"}:${page}`),
  () => getNextCachedTournamentList(archive, page),
  10,
);
const tournamentListLoads = new Map<string, Promise<TournamentListRow[]>>();

function getTournamentList(archive: boolean, page: number) {
  const key = `${archive ? "archive" : "current"}:${page}`;
  const existing = tournamentListLoads.get(key);
  if (existing) return existing;
  const pending = getCachedTournamentList(archive, page)
    .finally(() => tournamentListLoads.delete(key));
  tournamentListLoads.set(key, pending);
  return pending;
}

export default async function TournamentsPage({ searchParams }: {
  searchParams: Promise<{ view?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const archive = params.view === "archive";
  const requestedPage = typeof params.page === "string" && /^\d{1,6}$/.test(params.page) ? Number(params.page) : 1;
  const page = Math.max(1, requestedPage);
  const pageStart = performance.now();
  const tournamentsStart = performance.now();
  const tournamentListStart = performance.now();
  const tournamentList = await getTournamentList(archive, page).finally(() => logTiming("load-tournament-list", tournamentListStart));

  logTiming("load-tournaments", tournamentsStart);
  logTiming("tournaments-page", pageStart);

  return (
    <div className="page-shell space-y-8">
      <TournamentCatalog
        tournaments={tournamentList.slice(0, PAGE_SIZE).map((tournament) => ({ ...tournament, coverImage: getTournamentCoverUrl(tournament) }))}
        archive={archive}
        page={page}
        hasNext={tournamentList.length > PAGE_SIZE}
      />
      {!archive && page === 1 ? <DivisionPreviewCard canOpen={false} coverImage={null} /> : null}
    </div>
  );
}
