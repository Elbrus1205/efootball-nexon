CREATE TABLE "TelegramProcessedUpdate" (
    "updateId" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramProcessedUpdate_pkey" PRIMARY KEY ("updateId")
);

CREATE TABLE "TelegramAiRateBucket" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramAiRateBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramProcessedUpdate_expiresAt_idx" ON "TelegramProcessedUpdate"("expiresAt");
CREATE UNIQUE INDEX "TelegramAiRateBucket_scopeKey_windowStartedAt_key" ON "TelegramAiRateBucket"("scopeKey", "windowStartedAt");
CREATE INDEX "TelegramAiRateBucket_windowStartedAt_idx" ON "TelegramAiRateBucket"("windowStartedAt");
