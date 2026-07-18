-- Baseline generated from commit e028539, immediately before the first
-- incremental migration (20260425190000_add_affiliate_program).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MODERATOR', 'HEAD_JUDGE', 'JUDGE', 'PLAYER');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'LEAGUE', 'GROUPS', 'GROUPS_PLAYOFF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'READY', 'RESULT_SUBMITTED', 'CONFIRMED', 'REJECTED', 'FORFEIT', 'SCHEDULED', 'LIVE', 'DISPUTED', 'FINISHED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TOURNAMENT', 'MATCH', 'RESULT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITLIST', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('LEAGUE', 'GROUP_STAGE', 'PLAYOFF');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PlayoffType" AS ENUM ('SINGLE', 'DOUBLE');

-- CreateEnum
CREATE TYPE "SeedingMethod" AS ENUM ('MANUAL', 'RANDOM', 'RANKING', 'GROUP_RESULTS');

-- CreateEnum
CREATE TYPE "SortRule" AS ENUM ('POINTS', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'HEAD_TO_HEAD', 'WINS');

-- CreateEnum
CREATE TYPE "ClubSelectionMode" AS ENUM ('PLAYER_PICK', 'ADMIN_RANDOM');

-- CreateEnum
CREATE TYPE "MatchResultStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'GENERATE', 'APPROVE', 'REJECT', 'RESCHEDULE', 'FORFEIT');

-- CreateEnum
CREATE TYPE "LoginAttemptStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "VerificationCodePurpose" AS ENUM ('EMAIL_CONFIRMATION', 'PASSWORD_CHANGE', 'ACCOUNT_DELETION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "nameUpdatedAt" TIMESTAMP(3),
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "bannerImage" TEXT,
    "bio" TEXT,
    "passwordHash" TEXT,
    "nickname" TEXT,
    "efootballUid" TEXT,
    "favoriteTeam" TEXT,
    "telegramId" TEXT,
    "telegramUsername" TEXT,
    "telegram2faEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegram2faEnabledAt" TIMESTAMP(3),
    "vkId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "bannedUntil" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "legalAcceptedAt" TIMESTAMP(3),
    "legalAcceptedVersion" TEXT,
    "legalAcceptedIp" TEXT,
    "legalAcceptedUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "VerificationCodePurpose" NOT NULL DEFAULT 'EMAIL_CONFIRMATION',
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "coverImage" TEXT,
    "prizePool" TEXT,
    "format" "TournamentFormat" NOT NULL,
    "formatBlueprintJson" JSONB,
    "playoffType" "PlayoffType",
    "playoffLegs" INTEGER NOT NULL DEFAULT 1,
    "playoffThirdPlace" BOOLEAN NOT NULL DEFAULT false,
    "seedingMethod" "SeedingMethod" NOT NULL DEFAULT 'MANUAL',
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "registrationStartsAt" TIMESTAMP(3),
    "registrationEndsAt" TIMESTAMP(3) NOT NULL,
    "registrationClosedAt" TIMESTAMP(3),
    "checkInRequired" BOOLEAN NOT NULL DEFAULT false,
    "autoCreateMatches" BOOLEAN NOT NULL DEFAULT true,
    "autoCreateStages" BOOLEAN NOT NULL DEFAULT true,
    "autoCreateSchedule" BOOLEAN NOT NULL DEFAULT false,
    "autoAdvanceFromGroups" BOOLEAN NOT NULL DEFAULT false,
    "manualBracketControl" BOOLEAN NOT NULL DEFAULT false,
    "manualPlayoffSelection" BOOLEAN NOT NULL DEFAULT false,
    "clubSelectionMode" "ClubSelectionMode" NOT NULL DEFAULT 'ADMIN_RANDOM',
    "maxParticipants" INTEGER NOT NULL,
    "pointsForWin" INTEGER NOT NULL DEFAULT 3,
    "pointsForDraw" INTEGER NOT NULL DEFAULT 1,
    "pointsForLoss" INTEGER NOT NULL DEFAULT 0,
    "roundsInLeague" INTEGER NOT NULL DEFAULT 1,
    "groupsCount" INTEGER,
    "participantsPerGroup" INTEGER,
    "playoffTeamsPerGroup" INTEGER,
    "sortRules" "SortRule"[] DEFAULT ARRAY['POINTS', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'WINS']::"SortRule"[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentStage" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "type" "StageType" NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'DRAFT',
    "orderIndex" INTEGER NOT NULL,
    "settingsJson" JSONB,
    "groupsCount" INTEGER,
    "participantsPerGroup" INTEGER,
    "advancingPerGroup" INTEGER,
    "roundsCount" INTEGER,
    "pointsForWin" INTEGER,
    "pointsForDraw" INTEGER,
    "pointsForLoss" INTEGER,
    "sortRules" "SortRule"[] DEFAULT ARRAY['POINTS', 'GOAL_DIFFERENCE', 'GOALS_FOR', 'WINS']::"SortRule"[],
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundDeadline" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoundDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentGroup" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRegistration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'CONFIRMED',
    "seed" INTEGER,
    "stageSeed" INTEGER,
    "groupId" TEXT,
    "clubSlug" TEXT,
    "clubName" TEXT,
    "clubBadgePath" TEXT,
    "approvedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupStanding" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "goalDifference" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "tiebreakData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffBracket" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "type" "PlayoffType" NOT NULL,
    "size" INTEGER NOT NULL,
    "legsCount" INTEGER NOT NULL DEFAULT 1,
    "thirdPlaceMatch" BOOLEAN NOT NULL DEFAULT false,
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayoffBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketSlot" (
    "id" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "participantId" TEXT,
    "round" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "sourceType" TEXT DEFAULT 'MANUAL',
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stageId" TEXT,
    "groupId" TEXT,
    "bracketId" TEXT,
    "round" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "bracket" TEXT NOT NULL DEFAULT 'upper',
    "seriesKey" TEXT,
    "legNumber" INTEGER,
    "isPenaltyTiebreak" BOOLEAN NOT NULL DEFAULT false,
    "isThirdPlaceMatch" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "player1Id" TEXT,
    "player2Id" TEXT,
    "participant1EntryId" TEXT,
    "participant2EntryId" TEXT,
    "winnerId" TEXT,
    "winnerEntryId" TEXT,
    "player1Score" INTEGER,
    "player2Score" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "locationLabel" TEXT,
    "nextMatchId" TEXT,
    "nextMatchSlot" INTEGER,
    "loserNextMatchId" TEXT,
    "loserNextMatchSlot" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSchedule" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT DEFAULT 'Europe/Moscow',
    "slotLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResultSubmission" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "comment" TEXT,
    "player1Score" INTEGER NOT NULL,
    "player2Score" INTEGER NOT NULL,
    "status" "MatchResultStatus" NOT NULL DEFAULT 'PENDING',
    "moderatorComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "MatchResultSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" "AdminActionType" NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "key" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SecuritySession" (
    "id" TEXT NOT NULL,
    "authSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "platform" TEXT,
    "location" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SecuritySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "status" "LoginAttemptStatus" NOT NULL,
    "device" TEXT NOT NULL,
    "platform" TEXT,
    "location" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorChallenge" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_vkId_key" ON "User"("vkId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationCode_userId_email_purpose_createdAt_idx" ON "EmailVerificationCode"("userId", "email", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "EmailVerificationCode_email_expiresAt_idx" ON "EmailVerificationCode"("email", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Season_slug_key" ON "Season"("slug");

-- CreateIndex
CREATE INDEX "Season_isActive_idx" ON "Season"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE INDEX "Tournament_status_startsAt_idx" ON "Tournament"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Tournament_seasonId_status_idx" ON "Tournament"("seasonId", "status");

-- CreateIndex
CREATE INDEX "TournamentStage_tournamentId_orderIndex_idx" ON "TournamentStage"("tournamentId", "orderIndex");

-- CreateIndex
CREATE INDEX "RoundDeadline_tournamentId_stageId_round_idx" ON "RoundDeadline"("tournamentId", "stageId", "round");

-- CreateIndex
CREATE INDEX "RoundDeadline_deadlineAt_idx" ON "RoundDeadline"("deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoundDeadline_stageId_round_key" ON "RoundDeadline"("stageId", "round");

-- CreateIndex
CREATE INDEX "TournamentGroup_stageId_orderIndex_idx" ON "TournamentGroup"("stageId", "orderIndex");

-- CreateIndex
CREATE INDEX "TournamentRegistration_tournamentId_status_idx" ON "TournamentRegistration"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "TournamentRegistration_groupId_idx" ON "TournamentRegistration"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_userId_key" ON "TournamentRegistration"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_clubSlug_key" ON "TournamentRegistration"("tournamentId", "clubSlug");

-- CreateIndex
CREATE INDEX "GroupStanding_groupId_rank_idx" ON "GroupStanding"("groupId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "GroupStanding_groupId_participantId_key" ON "GroupStanding"("groupId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffBracket_stageId_key" ON "PlayoffBracket"("stageId");

-- CreateIndex
CREATE INDEX "PlayoffBracket_tournamentId_idx" ON "PlayoffBracket"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketSlot_bracketId_round_matchNumber_slotNumber_key" ON "BracketSlot"("bracketId", "round", "matchNumber", "slotNumber");

-- CreateIndex
CREATE INDEX "Match_tournamentId_round_matchNumber_idx" ON "Match"("tournamentId", "round", "matchNumber");

-- CreateIndex
CREATE INDEX "Match_stageId_status_idx" ON "Match"("stageId", "status");

-- CreateIndex
CREATE INDEX "Match_groupId_status_idx" ON "Match"("groupId", "status");

-- CreateIndex
CREATE INDEX "Match_bracketId_seriesKey_idx" ON "Match"("bracketId", "seriesKey");

-- CreateIndex
CREATE INDEX "MatchSchedule_startsAt_idx" ON "MatchSchedule"("startsAt");

-- CreateIndex
CREATE INDEX "MatchResultSubmission_status_createdAt_idx" ON "MatchResultSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_adminId_createdAt_idx" ON "AdminAction"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_tournamentId_createdAt_idx" ON "AdminAction"("tournamentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecuritySession_authSessionId_key" ON "SecuritySession"("authSessionId");

-- CreateIndex
CREATE INDEX "SecuritySession_userId_revokedAt_lastActiveAt_idx" ON "SecuritySession"("userId", "revokedAt", "lastActiveAt");

-- CreateIndex
CREATE INDEX "LoginHistory_userId_createdAt_idx" ON "LoginHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginHistory_email_createdAt_idx" ON "LoginHistory"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginHistory_status_createdAt_idx" ON "LoginHistory"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorChallenge_token_key" ON "TwoFactorChallenge"("token");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_userId_purpose_createdAt_idx" ON "TwoFactorChallenge"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "TwoFactorChallenge_token_expiresAt_idx" ON "TwoFactorChallenge"("token", "expiresAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationCode" ADD CONSTRAINT "EmailVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentStage" ADD CONSTRAINT "TournamentStage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundDeadline" ADD CONSTRAINT "RoundDeadline_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundDeadline" ADD CONSTRAINT "RoundDeadline_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TournamentStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentGroup" ADD CONSTRAINT "TournamentGroup_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TournamentStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStanding" ADD CONSTRAINT "GroupStanding_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStanding" ADD CONSTRAINT "GroupStanding_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TournamentRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffBracket" ADD CONSTRAINT "PlayoffBracket_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffBracket" ADD CONSTRAINT "PlayoffBracket_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TournamentStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "PlayoffBracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "TournamentStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "PlayoffBracket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_participant1EntryId_fkey" FOREIGN KEY ("participant1EntryId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_participant2EntryId_fkey" FOREIGN KEY ("participant2EntryId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSchedule" ADD CONSTRAINT "MatchSchedule_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResultSubmission" ADD CONSTRAINT "MatchResultSubmission_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResultSubmission" ADD CONSTRAINT "MatchResultSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecuritySession" ADD CONSTRAINT "SecuritySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorChallenge" ADD CONSTRAINT "TwoFactorChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
