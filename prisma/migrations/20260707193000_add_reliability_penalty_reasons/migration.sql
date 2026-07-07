DO $$
BEGIN
  CREATE TYPE "ReliabilityPenaltyScope" AS ENUM (
    'SCORE_SUBMISSION',
    'PLAYER_REPLACEMENT',
    'TECHNICAL_LOSS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReliabilityPenaltyReason" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "points" INTEGER NOT NULL,
  "scope" "ReliabilityPenaltyScope" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReliabilityPenaltyReason_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReliabilityPenaltyReason_scope_isActive_idx" ON "ReliabilityPenaltyReason"("scope", "isActive");
CREATE INDEX IF NOT EXISTS "ReliabilityPenaltyReason_createdAt_idx" ON "ReliabilityPenaltyReason"("createdAt");

INSERT INTO "ReliabilityPenaltyReason" ("id", "title", "description", "points", "scope", "isActive", "createdAt", "updatedAt")
VALUES
  ('relpen_score_false_score', 'Неверный счет', 'Администратор указал нарушение при вводе или подтверждении результата.', 5, 'SCORE_SUBMISSION', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('relpen_replacement_no_show', 'Замена из-за неявки', 'Игрок заменен, потому что не смог продолжить участие или не вышел на связь.', 8, 'PLAYER_REPLACEMENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('relpen_technical_no_show', 'Техническое поражение: неявка', 'Игрок не явился на матч или сорвал согласованное время игры.', 8, 'TECHNICAL_LOSS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
