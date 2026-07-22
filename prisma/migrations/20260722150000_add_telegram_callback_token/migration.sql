-- CreateTable
CREATE TABLE "TelegramCallbackToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "matchId" TEXT,
    "tournamentId" TEXT,
    "payload" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramCallbackToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramCallbackToken_token_key" ON "TelegramCallbackToken"("token");

-- CreateIndex
CREATE INDEX "TelegramCallbackToken_userId_action_createdAt_idx" ON "TelegramCallbackToken"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramCallbackToken_expiresAt_idx" ON "TelegramCallbackToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "TelegramCallbackToken" ADD CONSTRAINT "TelegramCallbackToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
