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
  "Account",
  "AdminAction",
  "BracketSlot",
  "DivisionMatch",
  "DivisionMatchHistory",
  "DivisionPlayer",
  "DivisionQueueEntry",
  "DivisionScoreSubmission",
  "DivisionSeason",
  "DivisionSeasonArchive",
  "DivisionSettings",
  "EmailVerificationCode",
  "FaqAttachment",
  "FaqItem",
  "GroupStanding",
  "LoginHistory",
  "Match",
  "MatchLineupPlayer",
  "MatchResultSubmission",
  "MatchSchedule",
  "Notification",
  "PasswordResetToken",
  "PlayoffBracket",
  "ReliabilityEvent",
  "ReliabilityPenaltyReason",
  "RolePermission",
  "RoundDeadline",
  "Season",
  "SecuritySession",
  "Session",
  "SiteContent",
  "Tournament",
  "TournamentGroup",
  "TournamentRegistration",
  "TournamentRegistrationMember",
  "TournamentStage",
  "TwinAccountAlert",
  "TwoFactorChallenge",
  "User",
  "UserAchievement",
  "UserProfileStatus",
  "UserWarning",
  "VerificationToken",
  "_prisma_migrations",
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

async function ensurePublicTableDenyPolicies() {
  for (const tableName of publicTablesRequiringRls) {
    const qualifiedTable = `public.${sqlIdentifier(tableName)}`;

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF to_regclass(${sqlString(qualifiedTable)}) IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM pg_policy
            WHERE polrelid = to_regclass(${sqlString(qualifiedTable)})
              AND polname = 'deny_all_public_access'
          )
        THEN
          EXECUTE 'CREATE POLICY deny_all_public_access ON ${qualifiedTable} AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false)';
        END IF;
      END $$;
    `);
  }
}

async function ensureRlsAutoEnableExecuteRevoked() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';

        IF to_regrole('anon') IS NOT NULL THEN
          EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon';
        END IF;

        IF to_regrole('authenticated') IS NOT NULL THEN
          EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated';
        END IF;
      END IF;
    END $$;
  `);
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
  await ensurePublicTableDenyPolicies();
  await ensureRlsAutoEnableExecuteRevoked();
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
