DO $$ BEGIN
  CREATE TYPE "CoinServiceOrderStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'EXECUTOR_DONE', 'COMPLETED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CoinStoreSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "coinsStoreEnabled" BOOLEAN NOT NULL DEFAULT true,
  "servicesStoreEnabled" BOOLEAN NOT NULL DEFAULT true,
  "paymentCard" TEXT,
  "paymentRecipient" TEXT,
  "paymentComment" TEXT,
  "defaultExecutorPercent" INTEGER NOT NULL DEFAULT 70,
  "defaultOwnerPercent" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoinStoreSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CoinServiceProduct" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priceKopecks" INTEGER NOT NULL,
  "executorPercent" INTEGER NOT NULL DEFAULT 70,
  "ownerPercent" INTEGER NOT NULL DEFAULT 30,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoinServiceProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CoinServiceOrder" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "executorId" TEXT,
  "status" "CoinServiceOrderStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "productTitle" TEXT NOT NULL,
  "productDescription" TEXT NOT NULL,
  "priceKopecks" INTEGER NOT NULL,
  "executorPercent" INTEGER NOT NULL,
  "ownerPercent" INTEGER NOT NULL,
  "executorEarningKopecks" INTEGER NOT NULL,
  "ownerEarningKopecks" INTEGER NOT NULL,
  "buyerTelegram" TEXT NOT NULL,
  "konamiLogin" TEXT NOT NULL,
  "konamiPassword" TEXT NOT NULL,
  "buyerComment" TEXT,
  "paymentCard" TEXT,
  "paymentRecipient" TEXT,
  "paymentComment" TEXT,
  "adminComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "executorCompletedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),

  CONSTRAINT "CoinServiceOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CoinServiceOrderMessage" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CoinServiceOrderMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoinServiceProduct_isActive_sortOrder_idx" ON "CoinServiceProduct"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "CoinServiceProduct_createdAt_idx" ON "CoinServiceProduct"("createdAt");
CREATE INDEX IF NOT EXISTS "CoinServiceOrder_status_createdAt_idx" ON "CoinServiceOrder"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CoinServiceOrder_buyerId_createdAt_idx" ON "CoinServiceOrder"("buyerId", "createdAt");
CREATE INDEX IF NOT EXISTS "CoinServiceOrder_executorId_status_idx" ON "CoinServiceOrder"("executorId", "status");
CREATE INDEX IF NOT EXISTS "CoinServiceOrderMessage_orderId_createdAt_idx" ON "CoinServiceOrderMessage"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "CoinServiceOrderMessage_senderId_createdAt_idx" ON "CoinServiceOrderMessage"("senderId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "CoinServiceOrder" ADD CONSTRAINT "CoinServiceOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CoinServiceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoinServiceOrder" ADD CONSTRAINT "CoinServiceOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoinServiceOrder" ADD CONSTRAINT "CoinServiceOrder_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoinServiceOrderMessage" ADD CONSTRAINT "CoinServiceOrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CoinServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoinServiceOrderMessage" ADD CONSTRAINT "CoinServiceOrderMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
