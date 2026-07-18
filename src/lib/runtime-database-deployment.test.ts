import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";

const root = process.cwd();

test("the production container starts the application without runtime DDL", () => {
  const dockerfile = readFileSync(path.join(root, "Dockerfile"), "utf8");
  const startScript = readFileSync(path.join(root, "scripts", "start-standalone.mjs"), "utf8");
  const regulations = readFileSync(path.join(root, "src", "lib", "regulations.ts"), "utf8");

  assert.match(dockerfile, /COPY --from=builder \/app\/scripts \.\/scripts/);
  assert.match(dockerfile, /CMD \["node", "scripts\/start-standalone\.mjs"\]/);
  assert.doesNotMatch(startScript, /ensure-runtime-database/);
  assert.doesNotMatch(startScript, /prisma (?:migrate deploy|db push)/);
  assert.doesNotMatch(regulations, /CREATE TABLE IF NOT EXISTS/);
});

test("production database changes are applied explicitly through Prisma migrations", () => {
  const packageJson = readFileSync(path.join(root, "package.json"), "utf8");
  const readme = readFileSync(path.join(root, "README.md"), "utf8");

  assert.match(packageJson, /"prisma:deploy": "prisma migrate deploy"/);
  assert.match(readme, /npm run prisma:deploy/);
  assert.match(readme, /не выполняет DDL при старте/i);
});

test("notification delivery schema is owned by a versioned migration", () => {
  const migration = readFileSync(
    path.join(root, "prisma", "migrations", "20260717193000_add_notification_delivery_outbox", "migration.sql"),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE "NotificationDelivery"/);
  assert.match(migration, /"pushDeliveredAt"/);
  assert.match(migration, /"telegramDeliveredAt"/);
});
