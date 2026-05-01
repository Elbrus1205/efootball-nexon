DO $$ BEGIN
  CREATE TYPE "CoinPaymentBank" AS ENUM ('OZON', 'TBANK', 'SBER', 'VTB');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CoinPaymentCard" (
  "id" TEXT NOT NULL,
  "bank" "CoinPaymentBank" NOT NULL,
  "cardNumber" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoinPaymentCard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoinPaymentCard_isActive_sortOrder_idx" ON "CoinPaymentCard"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "CoinPaymentCard_createdAt_idx" ON "CoinPaymentCard"("createdAt");

ALTER TABLE "CoinServiceOrder" ADD COLUMN IF NOT EXISTS "paymentBank" "CoinPaymentBank";
