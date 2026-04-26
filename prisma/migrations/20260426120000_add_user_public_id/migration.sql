ALTER TABLE "User" ADD COLUMN "publicId" TEXT;

WITH numbered_users AS (
  SELECT
    "id",
    (1000000000 + row_number() OVER (ORDER BY "createdAt", "id"))::text AS "nextPublicId"
  FROM "User"
)
UPDATE "User"
SET "publicId" = numbered_users."nextPublicId"
FROM numbered_users
WHERE "User"."id" = numbered_users."id";

ALTER TABLE "User" ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");
