import assert from "node:assert/strict";
import test from "node:test";

import { configureRuntimeDatabaseUrl } from "./database-url";

test("runtime pool defaults replace an undersized connection limit from DATABASE_URL", () => {
  const configured = configureRuntimeDatabaseUrl(
    "postgresql://user:secret@db.example.com:5432/app?connection_limit=1",
    {},
  );
  const url = new URL(configured);

  assert.equal(url.searchParams.get("connection_limit"), "5");
  assert.equal(url.searchParams.get("pool_timeout"), "20");
});

test("explicit runtime pool settings take precedence over DATABASE_URL", () => {
  const configured = configureRuntimeDatabaseUrl(
    "postgresql://user:secret@db.example.com:6543/app?connection_limit=2&pool_timeout=30",
    { connectionLimit: "8", poolTimeout: "12" },
  );
  const url = new URL(configured);

  assert.equal(url.searchParams.get("connection_limit"), "8");
  assert.equal(url.searchParams.get("pool_timeout"), "12");
});

test("invalid explicit pool settings fail without exposing database credentials", () => {
  const databaseUrl = "postgresql://private-user:private-password@db.example.com/app";

  assert.throws(
    () => configureRuntimeDatabaseUrl(databaseUrl, { connectionLimit: "0" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /PRISMA_CONNECTION_LIMIT/);
      assert.doesNotMatch(error.message, /private-user|private-password/);
      return true;
    },
  );
});

test("non-PostgreSQL and malformed URLs are preserved", () => {
  assert.equal(configureRuntimeDatabaseUrl("file:./dev.db", {}), "file:./dev.db");
  assert.equal(configureRuntimeDatabaseUrl("not a url", {}), "not a url");
});
