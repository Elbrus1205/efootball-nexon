DO $$ BEGIN
  CREATE TYPE "CoinProductPlatform" AS ENUM ('android', 'ios', 'promo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CoinProduct" (
  "id" TEXT NOT NULL,
  "platform" "CoinProductPlatform" NOT NULL,
  "title" TEXT NOT NULL,
  "coins" INTEGER NOT NULL,
  "priceKopecks" INTEGER NOT NULL,
  "costKopecks" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoinProduct_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoinProduct_platform_isActive_idx" ON "CoinProduct"("platform", "isActive");
CREATE INDEX IF NOT EXISTS "CoinProduct_createdAt_idx" ON "CoinProduct"("createdAt");
