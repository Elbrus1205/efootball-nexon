import { Prisma, TournamentStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { DivisionPreviewCard } from "@/components/divisions/division-preview-card";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { db } from "@/lib/db";

export const revalidate = 10;

function logTiming(label: string, start: number) {
  if (process.env.NODE_ENV === "production") return;
  console.log(`${label}: ${(performance.now() - start).toFixed(3)}ms`);
}

type TournamentListRow = {
  id: string;
  title: string;
  status: TournamentStatus;
  startsAt: Date | string;
  maxParticipants: number;
  prizePool: string | null;
  hasCoverImage: boolean;
  updatedAt: Date | string;
  isTest: boolean;
  autoOpenRegistration: boolean;
  registrationStartsAt: Date | null;
  participantsCount: number;
};

function getTournamentCoverUrl(tournament: Pick<TournamentListRow, "id" | "hasCoverImage" | "updatedAt">) {
  return tournament.hasCoverImage ? `/api/tournaments/${tournament.id}/cover?w=720&h=405&q=84&v=${new Date(tournament.updatedAt).getTime()}` : null;
}

function loadTournamentList(showTestTournaments: boolean) {
  const whereClause = showTestTournaments ? Prisma.empty : Prisma.sql`WHERE t."isTest" = false`;

  return db.$queryRaw<TournamentListRow[]>(Prisma.sql`
    SELECT
      t.id,
      t.title,
      t.status::text AS status,
      t."startsAt",
      t."maxParticipants",
      t."prizePool",
      (t."coverImage" IS NOT NULL AND t."coverImage" <> '') AS "hasCoverImage",
      t."updatedAt",
      t."isTest",
      t."autoOpenRegistration",
      t."registrationStartsAt",
      (
        SELECT COUNT(*)::int
        FROM "TournamentRegistration" p
        WHERE p."tournamentId" = t.id AND p.status <> 'REMOVED'::"ParticipantStatus"
      ) AS "participantsCount"
    FROM "Tournament" t
    ${whereClause}
    ORDER BY t.status ASC, t."startsAt" ASC
  `);
}

const getCachedTournamentList = unstable_cache(loadTournamentList, ["public-tournament-list"], {
  revalidate: 10,
  tags: ["public-tournaments"],
});
const tournamentListLoads = new Map<string, Promise<TournamentListRow[]>>();
const tournamentListValues = new Map<string, { expiresAt: number; value: TournamentListRow[] }>();

function getTournamentList(showTestTournaments: boolean) {
  const key = showTestTournaments ? "with-tests" : "public";
  const cached = tournamentListValues.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  if (cached) tournamentListValues.delete(key);
  const existing = tournamentListLoads.get(key);
  if (existing) return existing;
  const pending = getCachedTournamentList(showTestTournaments)
    .then((value) => {
      tournamentListValues.set(key, { expiresAt: Date.now() + 10_000, value });
      return value;
    })
    .finally(() => tournamentListLoads.delete(key));
  tournamentListLoads.set(key, pending);
  return pending;
}

export default async function TournamentsPage() {
  const pageStart = performance.now();
  const tournamentsStart = performance.now();
  const tournamentListStart = performance.now();
  const tournamentList = await getTournamentList(false).finally(() => logTiming("load-tournament-list", tournamentListStart));

  logTiming("load-tournaments", tournamentsStart);
  logTiming("tournaments-page", pageStart);

  return (
    <div className="page-shell space-y-8">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Турниры</div>

      <DivisionPreviewCard canOpen={false} coverImage={null} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tournamentList.map((tournament, index) => (
          <TournamentCard
            key={tournament.id}
            tournament={{ ...tournament, startsAt: new Date(tournament.startsAt), coverImage: getTournamentCoverUrl(tournament) }}
            participantsCount={tournament.participantsCount}
            priorityImage={index === 0}
          />
        ))}
      </div>
    </div>
  );
}
