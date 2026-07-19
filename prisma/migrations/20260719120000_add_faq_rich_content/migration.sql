-- Add optional structured rich-content blocks to FAQ items.
-- Legacy rows keep their plain-text "answer"; the app falls back to it when
-- "contentJson" is NULL, so existing published FAQ entries are preserved.
ALTER TABLE "FaqItem" ADD COLUMN "contentJson" TEXT;
