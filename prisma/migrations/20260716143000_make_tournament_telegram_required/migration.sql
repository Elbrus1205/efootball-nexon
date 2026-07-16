ALTER TABLE "Tournament"
ALTER COLUMN "requireTelegramForRegistration" SET DEFAULT true;

UPDATE "Tournament"
SET "requireTelegramForRegistration" = true
WHERE "requireTelegramForRegistration" = false;
