import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";

const root = process.cwd();

test("the production container runs runtime database compatibility checks", () => {
  const dockerfile = readFileSync(path.join(root, "Dockerfile"), "utf8");

  assert.match(dockerfile, /COPY --from=builder \/app\/scripts \.\/scripts/);
  assert.match(dockerfile, /CMD \["node", "scripts\/start-standalone\.mjs"\]/);
});

test("runtime database checks cover Telegram rich publication schema", () => {
  const runtimeDatabaseScript = readFileSync(
    path.join(root, "scripts", "ensure-runtime-database.mjs"),
    "utf8",
  );

  assert.match(runtimeDatabaseScript, /telegramCommunityId/);
  assert.match(runtimeDatabaseScript, /TelegramPublication/);
  assert.match(runtimeDatabaseScript, /WebPushSubscription/);
});
