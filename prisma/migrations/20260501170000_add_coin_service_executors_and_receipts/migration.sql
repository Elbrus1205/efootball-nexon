-- CreateTable
CREATE TABLE "CoinServiceExecutor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinServiceExecutor_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CoinServiceOrder" ADD COLUMN "paymentReceiptUrl" TEXT;
ALTER TABLE "CoinServiceOrder" ADD COLUMN "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "CoinServiceExecutor_userId_key" ON "CoinServiceExecutor"("userId");

-- CreateIndex
CREATE INDEX "CoinServiceExecutor_isActive_idx" ON "CoinServiceExecutor"("isActive");

-- AddForeignKey
ALTER TABLE "CoinServiceExecutor" ADD CONSTRAINT "CoinServiceExecutor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
