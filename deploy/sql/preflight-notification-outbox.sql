-- Read-only preflight for 20260717193000_add_notification_delivery_outbox.
-- The result must contain zero rows before `prisma migrate deploy`.
SELECT
  "tournamentId",
  "clubSlug",
  COUNT(*) AS "pendingCount"
FROM "TournamentRegistrationApplication"
WHERE "status" = 'PENDING' AND "clubSlug" IS NOT NULL
GROUP BY "tournamentId", "clubSlug"
HAVING COUNT(*) > 1
ORDER BY "pendingCount" DESC, "tournamentId", "clubSlug";
