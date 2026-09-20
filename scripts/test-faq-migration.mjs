// Run with: node --test scripts/test-faq-migration.mjs
// Requires the configured PostgreSQL connection. All writes use temporary tables.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());
const sql = readFileSync(new URL("../prisma/migrations/20260920120000_move_static_faq_to_database/migration.sql", import.meta.url), "utf8");

test("FAQ migration preserves content, skips matching IDs/titles and can be repeated safely", async () => {
  const db = new PrismaClient();
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "FaqItem" (LIKE public."FaqItem" INCLUDING ALL) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "FaqAttachment" (LIKE public."FaqAttachment" INCLUDING ALL) ON COMMIT DROP');
      assert.equal(await tx.$executeRawUnsafe(sql), 10);
      const readItems = () => tx.$queryRawUnsafe('SELECT * FROM pg_temp."FaqItem" ORDER BY "sortOrder"');
      const imported = await readItems();
      assert.equal(imported.length, 10);
      assert.equal(new Set(imported.map((row) => row.title)).size, 10);
      assert.equal(imported.filter((row) => row.category === "Безопасность аккаунта").length, 5);
      assert.equal(imported.filter((row) => row.category === "Надёжность").length, 5);
      assert.equal(imported[0].title, "Как обезопасить свой аккаунт?");
      for (const row of imported) {
        assert.equal(row.isPublished, true);
        const blocks = JSON.parse(row.contentJson);
        assert.ok(blocks.length >= 3);
        assert.equal(blocks.map((block) => block.text).join("\n\n"), row.answer);
      }
      assert.equal(await tx.$executeRawUnsafe(sql), 0);
      assert.deepEqual(await readItems(), imported);

      await tx.$executeRawUnsafe('DELETE FROM pg_temp."FaqItem"');
      await tx.$executeRaw`
        INSERT INTO pg_temp."FaqItem" ("id", "title", "answer", "contentJson", "category", "isPublished", "sortOrder", "updatedAt")
        VALUES ('static-secure-account', 'Administrator changed the title', 'Edited answer', ${JSON.stringify([{ type: "image", url: "/uploads/admin.png" }])}, 'Custom category', false, 500, CURRENT_TIMESTAMP),
               ('existing-password', ${"  КАК СОЗДАТЬ  ИЛИ СМЕНИТЬ ПАРОЛЬ?  "}, 'Existing password advice', NULL, ${"Безопасность"}, false, 501, CURRENT_TIMESTAMP)
      `;
      await tx.$executeRawUnsafe(`INSERT INTO pg_temp."FaqAttachment" ("id", "faqItemId", "kind", "url", "title") VALUES ('existing-media', 'existing-password', 'IMAGE', '/uploads/password.png', 'Original screenshot')`);
      const before = await readItems();
      const attachmentsBefore = await tx.$queryRawUnsafe('SELECT * FROM pg_temp."FaqAttachment"');
      assert.equal(await tx.$executeRawUnsafe(sql), 8);
      const allAfter = await readItems();
      assert.equal(allAfter.length, 10);
      const after = allAfter.filter((row) => before.some((original) => original.id === row.id));
      assert.deepEqual(after, before, "Existing text, rich media, attachments, draft state and order must survive");
      assert.deepEqual(await tx.$queryRawUnsafe('SELECT * FROM pg_temp."FaqAttachment"'), attachmentsBefore);
      assert.equal(await tx.$executeRawUnsafe(sql), 0);
    }, { timeout: 30_000 });
  } finally {
    await db.$disconnect();
  }
});
