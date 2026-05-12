INSERT INTO "SiteContent" ("key", "body", "updatedAt")
VALUES ('home-stats', '{"tournaments":0,"prizePool":0,"users":0,"online":0}', NOW())
ON CONFLICT ("key") DO UPDATE
SET "body" = EXCLUDED."body",
    "updatedAt" = NOW();
