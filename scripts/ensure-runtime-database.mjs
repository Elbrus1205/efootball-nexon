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

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Runtime database checks were skipped.");
    return;
  }

  for (const type of profileStatusTypes) {
    await ensureProfileStatusType(type);
  }

  await ensureUserProfileStatusColumns();
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
