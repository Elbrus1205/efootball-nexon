CREATE TYPE "CoinServiceExecutorAttemptStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'REJECTED');

ALTER TYPE "CoinServiceOrderStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "CoinServiceOrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_EXECUTOR';

CREATE TABLE "CoinServiceExecutorAttempt" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "executorId" TEXT NOT NULL,
  "status" "CoinServiceExecutorAttemptStatus" NOT NULL DEFAULT 'ASSIGNED',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),

  CONSTRAINT "CoinServiceExecutorAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoinServiceExecutorAttempt_orderId_createdAt_idx" ON "CoinServiceExecutorAttempt"("orderId", "createdAt");
CREATE INDEX "CoinServiceExecutorAttempt_executorId_status_idx" ON "CoinServiceExecutorAttempt"("executorId", "status");

ALTER TABLE "CoinServiceExecutorAttempt"
  ADD CONSTRAINT "CoinServiceExecutorAttempt_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CoinServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoinServiceExecutorAttempt"
  ADD CONSTRAINT "CoinServiceExecutorAttempt_executorId_fkey"
  FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
