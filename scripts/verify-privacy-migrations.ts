import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// All fixtures and DDL live in an isolated schema inside one rolled-back
// transaction. No application tables are read or changed.
const db = new PrismaClient();
const schema = `nexon_validation_${randomUUID().replaceAll("-", "")}`;
const rollback = new Error("VALIDATION_SUCCEEDED_ROLLBACK");

async function main() {
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      const setup = [
        'CREATE TABLE "User" (id TEXT PRIMARY KEY, "dateOfBirth" DATE, "guardianFullName" TEXT, "guardianEmail" TEXT, "guardianConsentAt" TIMESTAMP, "guardianConsentVersion" TEXT, "guardianConsentIp" TEXT, "guardianConsentUserAgent" TEXT)',
        'CREATE TABLE "SecuritySession" (id TEXT PRIMARY KEY, "userId" TEXT, "lastActiveAt" TIMESTAMP, "revokedAt" TIMESTAMP)',
        'CREATE TABLE "TournamentRegistration" (id TEXT PRIMARY KEY, "tournamentId" TEXT, "userId" TEXT, status TEXT, "clubSlug" TEXT, "clubName" TEXT, "clubBadgePath" TEXT)',
        'CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_userId_key" ON "TournamentRegistration"("tournamentId", "userId")',
        'CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_clubSlug_key" ON "TournamentRegistration"("tournamentId", "clubSlug")',
        'CREATE TABLE "AdminAction" ("entityId" TEXT, "entityType" TEXT, "beforeJson" JSONB, "afterJson" JSONB, "createdAt" TIMESTAMP)',
        `INSERT INTO "User" (id, "dateOfBirth") VALUES ('user', '2000-01-01')`,
        `INSERT INTO "SecuritySession" VALUES ('expired', 'user', CURRENT_TIMESTAMP - INTERVAL '31 days', NULL), ('active', 'user', CURRENT_TIMESTAMP, NULL)`,
        `INSERT INTO "TournamentRegistration" VALUES ('old', 'cup', 'alice', 'REMOVED', NULL, NULL, NULL), ('current', 'cup', 'bob', 'CONFIRMED', 'arsenal', 'Arsenal', '/arsenal.png')`,
        `INSERT INTO "AdminAction" VALUES ('old', 'TOURNAMENT_PARTICIPANT', '{"clubSlug":"arsenal","clubName":"Arsenal","clubBadgePath":"/arsenal.png"}', '{"replacementRegistration":{"id":"current"}}', CURRENT_TIMESTAMP)`,
      ];
      for (const sql of setup) await tx.$executeRawUnsafe(sql);
      for (const migration of ["20260910160000_registration_privacy_sessions", "20260910161000_preserve_replaced_participants"]) {
        const statements = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8").split(";").filter(sql => sql.trim());
        for (const sql of statements) await tx.$executeRawUnsafe(sql);
      }
      assert.deepEqual(await tx.$queryRawUnsafe('SELECT id FROM "SecuritySession"'), [{ id: "active" }]);
      assert.deepEqual(await tx.$queryRawUnsafe('SELECT "crossBorderConsentAt" FROM "User"'), [{ crossBorderConsentAt: null }]);
      assert.deepEqual(await tx.$queryRawUnsafe('SELECT "clubName" FROM "TournamentRegistration" WHERE id = \'old\''), [{ clubName: "Arsenal" }]);
      const removedColumns = await tx.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'User' AND (column_name = 'dateOfBirth' OR column_name LIKE 'guardian%')`;
      assert.equal(removedColumns.length, 0);
      // Returning the first player must create a NEW registration, preserving
      // the old match reference and keeping only one active club occupant.
      await tx.$executeRawUnsafe(`UPDATE "TournamentRegistration" SET status = 'REMOVED' WHERE id = 'current'`);
      await tx.$executeRawUnsafe(`INSERT INTO "TournamentRegistration" VALUES ('returned', 'cup', 'alice', 'CONFIRMED', 'arsenal', 'Arsenal', '/arsenal.png')`);
      assert.deepEqual(await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "TournamentRegistration"'), [{ count: 3 }]);
      await tx.$executeRawUnsafe("SAVEPOINT duplicate_active");
      await assert.rejects(tx.$executeRawUnsafe(`INSERT INTO "TournamentRegistration" VALUES ('duplicate', 'cup', 'other', 'CONFIRMED', 'arsenal', 'Arsenal', '/arsenal.png')`));
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT duplicate_active");
      throw rollback;
    }, { timeout: 60_000, maxWait: 15_000 });
  } catch (error) {
    if (error !== rollback) throw error;
    console.log("Migration validation passed; isolated schema and fixtures rolled back.");
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Migration validation failed"); process.exitCode = 1; });
