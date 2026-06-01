CREATE TABLE "UserWarning" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "issuedById" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserWarning_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserWarning_userId_createdAt_idx" ON "UserWarning"("userId", "createdAt");
CREATE INDEX "UserWarning_issuedById_createdAt_idx" ON "UserWarning"("issuedById", "createdAt");

ALTER TABLE "UserWarning" ADD CONSTRAINT "UserWarning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserWarning" ADD CONSTRAINT "UserWarning_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
