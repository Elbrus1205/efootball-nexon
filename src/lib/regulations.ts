import { db } from "@/lib/db";

export const DEFAULT_REGULATIONS_TEXT =
  "Заполните здесь официальный регламент турниров: сроки, подтверждение матчей, правила переигровок, технические поражения и требования к скриншотам.";

async function ensureSiteContentTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "SiteContent" (
      "key" TEXT PRIMARY KEY,
      "body" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

export async function getRegulationsText() {
  await ensureSiteContentTable();

  const rows = await db.$queryRaw<Array<{ body: string }>>`
    SELECT "body" FROM "SiteContent" WHERE "key" = 'regulations' LIMIT 1
  `;

  return rows[0]?.body ?? DEFAULT_REGULATIONS_TEXT;
}

export async function saveRegulationsText(body: string) {
  await ensureSiteContentTable();

  await db.$executeRaw`
    INSERT INTO "SiteContent" ("key", "body", "updatedAt")
    VALUES ('regulations', ${body}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key")
    DO UPDATE SET "body" = EXCLUDED."body", "updatedAt" = CURRENT_TIMESTAMP
  `;
}
