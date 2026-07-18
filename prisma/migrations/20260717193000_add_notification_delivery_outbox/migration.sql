CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "pushDeliveredAt" TIMESTAMP(3),
    "telegramDeliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "skipTelegram" BOOLEAN NOT NULL DEFAULT false,
    "telegramPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDelivery_notificationId_key" ON "NotificationDelivery"("notificationId");
CREATE INDEX "NotificationDelivery_deliveredAt_availableAt_idx" ON "NotificationDelivery"("deliveredAt", "availableAt");
CREATE INDEX "NotificationDelivery_lockToken_idx" ON "NotificationDelivery"("lockToken");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TournamentRegistrationApplication"
    WHERE "status" = 'PENDING' AND "clubSlug" IS NOT NULL
    GROUP BY "tournamentId", "clubSlug"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate pending tournament applications must be resolved before this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentRegistrationApplication_pending_club_key"
ON "TournamentRegistrationApplication"("tournamentId", "clubSlug")
WHERE "status" = 'PENDING' AND "clubSlug" IS NOT NULL;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_public_access"
  ON "NotificationDelivery"
  FOR ALL
  TO PUBLIC
  USING (false)
  WITH CHECK (false);
