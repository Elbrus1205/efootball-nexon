ALTER TABLE "Tournament"
ADD COLUMN "telegramCommunityId" TEXT,
ADD COLUMN "telegramChannelId" TEXT,
ADD COLUMN "telegramGroupId" TEXT,
ADD COLUMN "telegramAutoPublish" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TelegramPublication" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramPublication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramPublication_tournamentId_chatId_kind_key"
ON "TelegramPublication"("tournamentId", "chatId", "kind");

CREATE INDEX "TelegramPublication_tournamentId_updatedAt_idx"
ON "TelegramPublication"("tournamentId", "updatedAt");

CREATE INDEX "TelegramPublication_chatId_kind_idx"
ON "TelegramPublication"("chatId", "kind");

ALTER TABLE "TelegramPublication"
ADD CONSTRAINT "TelegramPublication_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
