CREATE TYPE "FaqAttachmentKind" AS ENUM ('IMAGE', 'FILE', 'VIDEO', 'LINK');

CREATE TABLE "FaqItem" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'Общее',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FaqAttachment" (
  "id" TEXT NOT NULL,
  "faqItemId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "kind" "FaqAttachmentKind" NOT NULL DEFAULT 'LINK',
  "mimeType" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FaqAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FaqItem_isPublished_sortOrder_createdAt_idx" ON "FaqItem"("isPublished", "sortOrder", "createdAt");
CREATE INDEX "FaqItem_category_sortOrder_idx" ON "FaqItem"("category", "sortOrder");
CREATE INDEX "FaqAttachment_faqItemId_sortOrder_idx" ON "FaqAttachment"("faqItemId", "sortOrder");

ALTER TABLE "FaqAttachment"
  ADD CONSTRAINT "FaqAttachment_faqItemId_fkey"
  FOREIGN KEY ("faqItemId") REFERENCES "FaqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
