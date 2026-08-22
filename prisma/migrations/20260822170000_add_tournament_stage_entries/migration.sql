CREATE TABLE "TournamentStageEntry" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "groupId" TEXT,
    "sourceTransitionId" TEXT,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TournamentStageEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentStageEntry_stageId_registrationId_key" ON "TournamentStageEntry"("stageId", "registrationId");
CREATE INDEX "TournamentStageEntry_registrationId_stageId_idx" ON "TournamentStageEntry"("registrationId", "stageId");
CREATE INDEX "TournamentStageEntry_groupId_idx" ON "TournamentStageEntry"("groupId");
ALTER TABLE "TournamentStageEntry" ADD CONSTRAINT "TournamentStageEntry_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TournamentStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentStageEntry" ADD CONSTRAINT "TournamentStageEntry_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentStageEntry" ADD CONSTRAINT "TournamentStageEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
