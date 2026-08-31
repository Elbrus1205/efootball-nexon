UPDATE "Club" AS club
SET "leagueId" = league.id,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "League" AS league
WHERE club.slug = 'lyon-big-2022'
  AND league.slug = 'ligue-1'
  AND club."leagueId" IS DISTINCT FROM league.id;
