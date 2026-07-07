import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const profileStatusTypes = [
  "SEASON_CHAMPION",
  "SEASON_VICE_CHAMPION",
  "SEASON_BRONZE",
  "CURRENT_CHAMPION",
  "LEGEND",
  "ACTIVE",
  "RELIABLE",
  "GOAL_MASTER",
  "AMBASSADOR",
];

const publicTablesRequiringRls = [
  "DivisionMatch",
  "DivisionMatchHistory",
  "DivisionPlayer",
  "DivisionQueueEntry",
  "DivisionScoreSubmission",
  "DivisionSeason",
  "DivisionSeasonArchive",
  "DivisionSettings",
  "FaqAttachment",
  "FaqItem",
  "MatchLineupPlayer",
  "ReliabilityEvent",
  "ReliabilityPenaltyReason",
  "RolePermission",
  "TournamentRegistrationMember",
  "TwinAccountAlert",
  "UserAchievement",
  "UserWarning",
];

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function ensureProfileStatusType(value) {
  await prisma.$executeRawUnsafe(`ALTER TYPE "ProfileStatusType" ADD VALUE IF NOT EXISTS ${sqlString(value)}`);
}

async function ensureUserProfileStatusColumns() {
  await prisma.$executeRawUnsafe('ALTER TABLE "UserProfileStatus" ADD COLUMN IF NOT EXISTS "youtubeUrl" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "UserProfileStatus" ADD COLUMN IF NOT EXISTS "youtubeChannelTitle" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "UserProfileStatus" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)');
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "UserProfileStatus" ADD COLUMN IF NOT EXISTS "expiredNotifiedAt" TIMESTAMP(3)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "UserProfileStatus_approvalStatus_expiresAt_expiredNotifiedAt_idx" ON "UserProfileStatus"("approvalStatus", "expiresAt", "expiredNotifiedAt")',
  );
}

async function ensureReliabilityPenaltyReasons() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "ReliabilityPenaltyScope" AS ENUM ('SCORE_SUBMISSION', 'PLAYER_REPLACEMENT', 'TECHNICAL_LOSS');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReliabilityPenaltyReason" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "points" INTEGER NOT NULL,
      "scope" "ReliabilityPenaltyScope" NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReliabilityPenaltyReason_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ReliabilityPenaltyReason_scope_isActive_idx" ON "ReliabilityPenaltyReason"("scope", "isActive")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ReliabilityPenaltyReason_createdAt_idx" ON "ReliabilityPenaltyReason"("createdAt")',
  );

  await prisma.$executeRawUnsafe(`
    INSERT INTO "ReliabilityPenaltyReason" ("id", "title", "description", "points", "scope", "isActive", "createdAt", "updatedAt")
    VALUES
      ('relpen_score_false_score', 'Неверный счет', 'Администратор указал нарушение при вводе или подтверждении результата.', 5, 'SCORE_SUBMISSION', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('relpen_replacement_no_show', 'Замена из-за неявки', 'Игрок заменен, потому что не смог продолжить участие или не вышел на связь.', 8, 'PLAYER_REPLACEMENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('relpen_technical_no_show', 'Техническое поражение: неявка', 'Игрок не явился на матч или сорвал согласованное время игры.', 8, 'TECHNICAL_LOSS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING
  `);
}

async function ensurePublicTableRls() {
  for (const tableName of publicTablesRequiringRls) {
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS public.${sqlIdentifier(tableName)} ENABLE ROW LEVEL SECURITY`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Runtime database checks were skipped.");
    return;
  }

  for (const type of profileStatusTypes) {
    await ensureProfileStatusType(type);
  }

  await ensureUserProfileStatusColumns();
  await ensureReliabilityPenaltyReasons();
  await ensurePublicTableRls();
  console.log("Runtime database checks completed.");
}

main()
  .catch((error) => {
    console.error("Runtime database checks failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
