-- AlterTable
ALTER TABLE "SecuritySession" ADD COLUMN "deviceFingerprint" TEXT;

-- AlterTable
ALTER TABLE "LoginHistory" ADD COLUMN "deviceFingerprint" TEXT;

-- CreateTable
CREATE TABLE "TwinAccountAlert" (
    "id" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "userIds" TEXT[],
    "accountsKey" TEXT NOT NULL,
    "lastNotifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwinAccountAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginHistory_deviceFingerprint_idx" ON "LoginHistory"("deviceFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "TwinAccountAlert_accountsKey_key" ON "TwinAccountAlert"("accountsKey");

-- CreateIndex
CREATE INDEX "TwinAccountAlert_deviceFingerprint_idx" ON "TwinAccountAlert"("deviceFingerprint");
