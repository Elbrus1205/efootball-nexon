UPDATE "User"
SET "name" = NULL
WHERE "name" IS NOT NULL
  AND BTRIM("name") = '';

UPDATE "User"
SET "name" = BTRIM("name")
WHERE "name" IS NOT NULL
  AND "name" <> BTRIM("name");

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY LOWER("name") ORDER BY "createdAt", id) AS rn
  FROM "User"
  WHERE "name" IS NOT NULL
),
duplicates AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
UPDATE "User"
SET
  "name" = CONCAT('Player', SUBSTRING(MD5(id) FROM 1 FOR 8)),
  "nameUpdatedAt" = COALESCE("nameUpdatedAt", NOW())
WHERE id IN (SELECT id FROM duplicates);

CREATE UNIQUE INDEX IF NOT EXISTS "User_name_lower_unique"
ON "User" (LOWER("name"))
WHERE "name" IS NOT NULL;
