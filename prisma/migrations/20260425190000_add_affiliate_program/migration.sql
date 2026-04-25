DO $$ BEGIN
  CREATE TYPE "AffiliatePurchaseSource" AS ENUM ('PROMO_CODE', 'REFERRAL_LINK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AffiliatePartner" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "promoCode" TEXT NOT NULL,
  "discountPercent" INTEGER NOT NULL DEFAULT 0,
  "activationLimit" INTEGER NOT NULL DEFAULT 0,
  "partnerPercent" INTEGER NOT NULL DEFAULT 0,
  "referralSlug" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AffiliatePartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AffiliateClick" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AffiliateReferral" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "userId" TEXT,
  "referralKey" TEXT NOT NULL,
  "displayName" TEXT,
  "contact" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AffiliateReferral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AffiliatePurchase" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "referralId" TEXT,
  "buyerUserId" TEXT,
  "buyerName" TEXT NOT NULL,
  "buyerContact" TEXT NOT NULL,
  "source" "AffiliatePurchaseSource" NOT NULL,
  "promoCode" TEXT,
  "platform" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "offerTitle" TEXT NOT NULL,
  "salePriceKopecks" INTEGER NOT NULL,
  "discountKopecks" INTEGER NOT NULL DEFAULT 0,
  "paidAmountKopecks" INTEGER NOT NULL,
  "costKopecks" INTEGER NOT NULL,
  "profitKopecks" INTEGER NOT NULL,
  "partnerEarningKopecks" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AffiliatePurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliatePartner_promoCode_key" ON "AffiliatePartner"("promoCode");
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliatePartner_referralSlug_key" ON "AffiliatePartner"("referralSlug");
CREATE INDEX IF NOT EXISTS "AffiliatePartner_ownerId_idx" ON "AffiliatePartner"("ownerId");
CREATE INDEX IF NOT EXISTS "AffiliatePartner_isActive_idx" ON "AffiliatePartner"("isActive");

CREATE INDEX IF NOT EXISTS "AffiliateClick_partnerId_createdAt_idx" ON "AffiliateClick"("partnerId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateReferral_partnerId_referralKey_key" ON "AffiliateReferral"("partnerId", "referralKey");
CREATE INDEX IF NOT EXISTS "AffiliateReferral_userId_idx" ON "AffiliateReferral"("userId");

CREATE INDEX IF NOT EXISTS "AffiliatePurchase_partnerId_createdAt_idx" ON "AffiliatePurchase"("partnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "AffiliatePurchase_referralId_idx" ON "AffiliatePurchase"("referralId");
CREATE INDEX IF NOT EXISTS "AffiliatePurchase_buyerUserId_idx" ON "AffiliatePurchase"("buyerUserId");

DO $$ BEGIN
  ALTER TABLE "AffiliatePartner" ADD CONSTRAINT "AffiliatePartner_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliatePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliatePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliatePurchase" ADD CONSTRAINT "AffiliatePurchase_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "AffiliatePartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliatePurchase" ADD CONSTRAINT "AffiliatePurchase_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "AffiliateReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AffiliatePurchase" ADD CONSTRAINT "AffiliatePurchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
